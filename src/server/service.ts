import type { GroupEvents } from '../adapters/events'
import { MEMBERS_MAX, PLAYERS_MIN, gameView, normalizeList } from '../core/game'
import type { GroupSummary, GroupView, GameView } from '../core/game'
import type { Repository } from '../db/repository'
import { createId, createToken } from './crypto'
import type { Notifier } from './notify'

/**
 * Every rule that keeps a game fair lives here or in `core/game`; the HTTP
 * surface only validates shapes and forwards. Failures throw a `Response` that
 * `rpc()` turns into a client-side error.
 *
 * Callers pass the signed-in user's id. Holding a group's link is enough to see
 * that the group exists and to join it; everything else needs membership.
 */
export class SealedListsService {
  constructor(
    private readonly repository: Repository,
    private readonly clock: () => number = Date.now,
    private readonly notifier?: Notifier,
    private readonly events?: GroupEvents,
  ) {}

  createGroup(userId: string, name: string) {
    const token = createToken()
    this.repository.createGroup({ id: createId(), name: name.trim(), token, ownerId: userId, now: this.clock() })
    return { token }
  }

  myGroups(userId: string): GroupSummary[] {
    return this.repository.groupsOf(userId).map((group) => {
      const active = this.repository.activeGame(group.id)
      const entry = active ? this.repository.entriesOf(active.id).find((candidate) => candidate.userId === userId) : undefined
      return { name: group.name, token: group.token, needsList: entry ? entry.list === null : false }
    })
  }

  /** Whether a link points at a group at all, so a dead one 404s instead of promising an invitation. */
  hasGroup(token: string) {
    return this.repository.groupByToken(token) !== undefined
  }

  groupView(token: string, userId: string): GroupView {
    const { group, members } = this.group(token)
    const isMember = members.some((member) => member.userId === userId)
    const active = this.repository.activeGame(group.id)
    const revealed = this.repository.revealedGames(group.id)
    const current = active ?? revealed.at(0)
    return {
      name: group.name,
      members,
      isMember,
      // Someone who only holds the link learns the group exists, and nothing else.
      currentGame: isMember && current ? gameView(current, this.repository.entriesOf(current.id), userId) : null,
      pastGames: isMember ? revealed.filter((game) => game.id !== current?.id).map((game) => ({ id: game.id, number: game.number })) : [],
      canStartGame: isMember && !active,
    }
  }

  joinGroup(token: string, userId: string): GroupView {
    const { group } = this.group(token)
    const result = this.repository.joinGroup({ groupId: group.id, userId, now: this.clock() })
    if (result === 'full') throw new Response(`a group holds at most ${MEMBERS_MAX} players`, { status: 409 })
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  /** The group behind a link, for a member: all an event stream needs to know. */
  memberGroupId(token: string, userId: string) {
    return this.requireMembership(token, userId).group.id
  }

  removeMember(token: string, userId: string, targetUserId: string): GroupView {
    const { group } = this.requireMembership(token, userId)
    const collecting = this.repository.activeGame(group.id)
    const result = this.repository.removeMember({ groupId: group.id, userId: targetUserId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'too-few') throw new Response('a group keeps at least one player', { status: 409 })
    if (collecting) this.notifyIfRevealed(group.id, collecting.id)
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  emailPreference(userId: string) {
    return { gameEmails: this.repository.gameEmails(userId) }
  }

  setEmailPreference(userId: string, gameEmails: boolean) {
    this.repository.setGameEmails(userId, gameEmails)
    return { gameEmails }
  }

  gameView(token: string, gameId: string, userId: string): GameView {
    const { group } = this.requireMembership(token, userId)
    const game = this.repository.gameById(group.id, gameId)
    if (!game) throw notFound()
    return gameView(game, this.repository.entriesOf(game.id), userId)
  }

  startGame(token: string, userId: string, userIds: string[]): GroupView {
    const { group, members } = this.requireMembership(token, userId)
    const playing = members.filter((member) => userIds.includes(member.userId))
    if (playing.length !== userIds.length) throw notFound()
    if (playing.length < PLAYERS_MIN) throw new Response(`a game needs at least ${PLAYERS_MIN} players`, { status: 400 })
    const result = this.repository.createGame({ id: createId(), groupId: group.id, userIds, now: this.clock() })
    if (result === 'in-progress') throw new Response('this group already has a game running', { status: 409 })
    this.notifier?.gameStarted(result.id, userId)
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  sealList(token: string, userId: string, list: string): GroupView {
    const { group } = this.requireMembership(token, userId)
    const game = this.repository.activeGame(group.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const text = normalizeList(list)
    if (!text) throw new Response('a list cannot be empty', { status: 400 })
    const result = this.repository.sealList({ gameId: game.id, userId, list: text, now: this.clock() })
    if (result === 'unknown') throw new Response('you are not playing in this game', { status: 403 })
    if (result === 'locked') throw locked()
    this.notifyIfRevealed(group.id, game.id)
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  /** Puts a group member into the running game — yourself when you decide you are playing after all. */
  joinGame(token: string, userId: string, targetUserId: string): GroupView {
    const { group, members } = this.requireMembership(token, userId)
    if (!members.some((member) => member.userId === targetUserId)) throw notFound()
    const game = this.repository.activeGame(group.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const result = this.repository.joinGame({ gameId: game.id, userId: targetUserId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'already-in') throw new Response('they are already in this game', { status: 409 })
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  dropPlayer(token: string, userId: string, targetUserId: string): GroupView {
    const { group } = this.requireMembership(token, userId)
    const game = this.repository.activeGame(group.id)
    if (!game) throw new Response('there is no game running', { status: 409 })
    const result = this.repository.dropEntry({ gameId: game.id, userId: targetUserId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'sealed') throw new Response('that player has already sealed a list', { status: 409 })
    if (result === 'too-few') throw new Response(`a game needs at least ${PLAYERS_MIN} players`, { status: 409 })
    this.notifyIfRevealed(group.id, game.id)
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  /**
   * Throws a game away for the whole group. Allowed while it is still
   * collecting, which is the only way out of a game nobody is going to finish,
   * and after the reveal, so history is the group's to keep or clear.
   */
  deleteGame(token: string, userId: string, gameId: string): GroupView {
    const { group } = this.requireMembership(token, userId)
    if (this.repository.deleteGame({ groupId: group.id, gameId }) === 'unknown') throw notFound()
    this.events?.publish(group.id)
    return this.groupView(token, userId)
  }

  /** Dropping the last outstanding player reveals a game too, so this runs after any of them. */
  private notifyIfRevealed(groupId: string, gameId: string) {
    const game = this.repository.gameById(groupId, gameId)
    if (game && game.revealedAt !== null) this.notifier?.gameRevealed(gameId)
  }

  private group(token: string) {
    const found = this.repository.groupByToken(token)
    if (!found) throw notFound()
    return found
  }

  private requireMembership(token: string, userId: string) {
    const found = this.group(token)
    if (!found.members.some((member) => member.userId === userId)) throw new Response('join the group first', { status: 403 })
    return found
  }
}

const notFound = () => new Response('that link does not point at anything', { status: 404 })
const locked = () => new Response('the lists are revealed and locked', { status: 409 })
