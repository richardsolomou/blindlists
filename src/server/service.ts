import { MEMBERS_MAX, MEMBERS_MIN, RETENTION_MS, gameView, normalizeList } from '../core/game'
import type { CrewView, GameView, MemberRecord } from '../core/game'
import type { Repository } from '../db/repository'
import { createId, createToken } from './crypto'

/**
 * Every rule that keeps a game fair lives here or in `core/game`; the HTTP
 * surface only validates shapes and forwards. Failures throw a `Response` that
 * `rpc()` turns into a client-side error.
 *
 * A crew's link is the only credential. Which member you are is a cookie the
 * caller passes in, and any of them may start a game or clear a no-show —
 * nobody can read another list before the reveal either way.
 */
export class BlindListsService {
  constructor(
    private readonly repository: Repository,
    private readonly clock: () => number = Date.now,
  ) {}

  createCrew(input: { name: string; memberNames: string[] }) {
    const token = createToken()
    this.repository.createCrew({
      id: createId(),
      name: input.name.trim(),
      token,
      createdAt: this.clock(),
      members: input.memberNames.map((name, index) => ({ id: createId(), name: name.trim(), seat: index + 1 })),
    })
    return { token }
  }

  crewView(token: string, viewerId: string | undefined): CrewView {
    const { crew, members } = this.crew(token)
    const viewer = members.find((member) => member.id === viewerId) ?? null
    const active = this.repository.activeGame(crew.id)
    const revealed = this.repository.revealedGames(crew.id)
    const current = active ?? revealed.at(0)
    return {
      name: crew.name,
      members,
      viewer,
      currentGame: current ? gameView(current, this.repository.entriesOf(current.id), viewer?.id ?? null) : null,
      pastGames: revealed.filter((game) => game.id !== current?.id).map((game) => ({ id: game.id, number: game.number })),
      canStartGame: !active,
    }
  }

  /** Confirms a name belongs to this crew before the caller stores it in a cookie. */
  claimMember(token: string, memberId: string): MemberRecord {
    const { members } = this.crew(token)
    const member = members.find((candidate) => candidate.id === memberId)
    if (!member) throw notFound()
    return member
  }

  gameView(token: string, gameId: string, viewerId: string | undefined): GameView {
    const { crew } = this.crew(token)
    const game = this.repository.gameById(crew.id, gameId)
    if (!game) throw notFound()
    return gameView(game, this.repository.entriesOf(game.id), viewerId ?? null)
  }

  startGame(token: string, viewerId: string | undefined, memberIds: string[]): CrewView {
    const { crew, members } = this.crew(token)
    this.requireMember(members, viewerId)
    const playing = members.filter((member) => memberIds.includes(member.id))
    if (playing.length !== memberIds.length) throw notFound()
    if (playing.length < 2) throw new Response('a game needs at least two players', { status: 400 })
    const result = this.repository.createGame({ id: createId(), crewId: crew.id, memberIds, now: this.clock() })
    if (result === 'in-progress') throw new Response('this crew already has a game running', { status: 409 })
    return this.crewView(token, viewerId)
  }

  sealList(token: string, viewerId: string | undefined, list: string): CrewView {
    const { crew, members } = this.crew(token)
    const viewer = this.requireMember(members, viewerId)
    const game = this.repository.activeGame(crew.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const text = normalizeList(list)
    if (!text) throw new Response('a list cannot be empty', { status: 400 })
    const result = this.repository.sealList({ gameId: game.id, memberId: viewer.id, list: text, now: this.clock() })
    if (result === 'unknown') throw new Response('you are not playing in this game', { status: 403 })
    if (result === 'locked') throw locked()
    return this.crewView(token, viewerId)
  }

  /** Puts a crew member into the running game — yourself when you decide you are playing after all. */
  joinGame(token: string, viewerId: string | undefined, memberId: string): CrewView {
    const { crew, members } = this.crew(token)
    this.requireMember(members, viewerId)
    if (!members.some((member) => member.id === memberId)) throw notFound()
    const game = this.repository.activeGame(crew.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const result = this.repository.joinGame({ gameId: game.id, memberId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'already-in') throw new Response('they are already in this game', { status: 409 })
    return this.crewView(token, viewerId)
  }

  removeMember(token: string, viewerId: string | undefined, memberId: string): CrewView {
    const { crew, members } = this.crew(token)
    this.requireMember(members, viewerId)
    const result = this.repository.removeMember({ crewId: crew.id, memberId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'too-few') throw new Response(`a crew keeps at least ${MEMBERS_MIN} players`, { status: 409 })
    return this.crewView(token, viewerId)
  }

  dropPlayer(token: string, viewerId: string | undefined, memberId: string): CrewView {
    const { crew, members } = this.crew(token)
    this.requireMember(members, viewerId)
    const game = this.repository.activeGame(crew.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const result = this.repository.dropEntry({ gameId: game.id, memberId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'sealed') throw new Response('that player has already sealed a list', { status: 409 })
    if (result === 'too-few') throw new Response('a game needs at least two players', { status: 409 })
    return this.crewView(token, viewerId)
  }

  addMember(token: string, viewerId: string | undefined, name: string): CrewView {
    const { crew, members } = this.crew(token)
    this.requireMember(members, viewerId)
    const result = this.repository.addMember({ crewId: crew.id, id: createId(), name: name.trim() })
    if (result === 'full') throw new Response(`a crew holds at most ${MEMBERS_MAX} players`, { status: 409 })
    return this.crewView(token, viewerId)
  }

  purgeExpiredGames() {
    return this.repository.deleteGamesCreatedBefore(this.clock() - RETENTION_MS)
  }

  private crew(token: string) {
    const found = this.repository.crewByToken(token)
    if (!found) throw notFound()
    return found
  }

  private requireMember(members: readonly MemberRecord[], viewerId: string | undefined) {
    const member = members.find((candidate) => candidate.id === viewerId)
    if (!member) throw new Response('tap your name first', { status: 403 })
    return member
  }
}

const notFound = () => new Response('this link is wrong, or what it pointed at has expired', { status: 404 })
const locked = () => new Response('the lists are revealed and locked', { status: 409 })
