import { MEMBERS_MAX, PLAYERS_MIN, gameView, normalizeList } from '../core/game'
import type { CrewSummary, CrewView, GameView } from '../core/game'
import type { Repository } from '../db/repository'
import { createId, createToken } from './crypto'

/**
 * Every rule that keeps a game fair lives here or in `core/game`; the HTTP
 * surface only validates shapes and forwards. Failures throw a `Response` that
 * `rpc()` turns into a client-side error.
 *
 * Callers pass the signed-in user's id. Holding a crew's link is enough to see
 * that the crew exists and to join it; everything else needs membership.
 */
export class SealedListsService {
  constructor(
    private readonly repository: Repository,
    private readonly clock: () => number = Date.now,
  ) {}

  createCrew(userId: string, name: string) {
    const token = createToken()
    this.repository.createCrew({ id: createId(), name: name.trim(), token, ownerId: userId, now: this.clock() })
    return { token }
  }

  myCrews(userId: string): CrewSummary[] {
    return this.repository.crewsOf(userId).map((crew) => {
      const active = this.repository.activeGame(crew.id)
      const entry = active ? this.repository.entriesOf(active.id).find((candidate) => candidate.userId === userId) : undefined
      return { name: crew.name, token: crew.token, needsList: entry ? entry.list === null : false }
    })
  }

  crewView(token: string, userId: string): CrewView {
    const { crew, members } = this.crew(token)
    const isMember = members.some((member) => member.userId === userId)
    const active = this.repository.activeGame(crew.id)
    const revealed = this.repository.revealedGames(crew.id)
    const current = active ?? revealed.at(0)
    return {
      name: crew.name,
      members,
      isMember,
      // Someone who only holds the link learns the crew exists, and nothing else.
      currentGame: isMember && current ? gameView(current, this.repository.entriesOf(current.id), userId) : null,
      pastGames: isMember ? revealed.filter((game) => game.id !== current?.id).map((game) => ({ id: game.id, number: game.number })) : [],
      canStartGame: isMember && !active,
    }
  }

  joinCrew(token: string, userId: string): CrewView {
    const { crew } = this.crew(token)
    const result = this.repository.joinCrew({ crewId: crew.id, userId, now: this.clock() })
    if (result === 'full') throw new Response(`a crew holds at most ${MEMBERS_MAX} players`, { status: 409 })
    return this.crewView(token, userId)
  }

  removeMember(token: string, userId: string, targetUserId: string): CrewView {
    const { crew } = this.requireMembership(token, userId)
    const result = this.repository.removeMember({ crewId: crew.id, userId: targetUserId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'too-few') throw new Response(`a crew keeps at least ${PLAYERS_MIN} players`, { status: 409 })
    return this.crewView(token, userId)
  }

  gameView(token: string, gameId: string, userId: string): GameView {
    const { crew } = this.requireMembership(token, userId)
    const game = this.repository.gameById(crew.id, gameId)
    if (!game) throw notFound()
    return gameView(game, this.repository.entriesOf(game.id), userId)
  }

  startGame(token: string, userId: string, userIds: string[]): CrewView {
    const { crew, members } = this.requireMembership(token, userId)
    const playing = members.filter((member) => userIds.includes(member.userId))
    if (playing.length !== userIds.length) throw notFound()
    if (playing.length < PLAYERS_MIN) throw new Response(`a game needs at least ${PLAYERS_MIN} players`, { status: 400 })
    const result = this.repository.createGame({ id: createId(), crewId: crew.id, userIds, now: this.clock() })
    if (result === 'in-progress') throw new Response('this crew already has a game running', { status: 409 })
    return this.crewView(token, userId)
  }

  sealList(token: string, userId: string, list: string): CrewView {
    const { crew } = this.requireMembership(token, userId)
    const game = this.repository.activeGame(crew.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const text = normalizeList(list)
    if (!text) throw new Response('a list cannot be empty', { status: 400 })
    const result = this.repository.sealList({ gameId: game.id, userId, list: text, now: this.clock() })
    if (result === 'unknown') throw new Response('you are not playing in this game', { status: 403 })
    if (result === 'locked') throw locked()
    return this.crewView(token, userId)
  }

  /** Puts a crew member into the running game — yourself when you decide you are playing after all. */
  joinGame(token: string, userId: string, targetUserId: string): CrewView {
    const { crew, members } = this.requireMembership(token, userId)
    if (!members.some((member) => member.userId === targetUserId)) throw notFound()
    const game = this.repository.activeGame(crew.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const result = this.repository.joinGame({ gameId: game.id, userId: targetUserId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'already-in') throw new Response('they are already in this game', { status: 409 })
    return this.crewView(token, userId)
  }

  dropPlayer(token: string, userId: string, targetUserId: string): CrewView {
    const { crew } = this.requireMembership(token, userId)
    const game = this.repository.activeGame(crew.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const result = this.repository.dropEntry({ gameId: game.id, userId: targetUserId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'sealed') throw new Response('that player has already sealed a list', { status: 409 })
    if (result === 'too-few') throw new Response(`a game needs at least ${PLAYERS_MIN} players`, { status: 409 })
    return this.crewView(token, userId)
  }

  private crew(token: string) {
    const found = this.repository.crewByToken(token)
    if (!found) throw notFound()
    return found
  }

  private requireMembership(token: string, userId: string) {
    const found = this.crew(token)
    if (!found.members.some((member) => member.userId === userId)) throw new Response('join the crew first', { status: 403 })
    return found
  }
}

const notFound = () => new Response('that link does not point at anything', { status: 404 })
const locked = () => new Response('the lists are revealed and locked', { status: 409 })
