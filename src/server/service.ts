import { RETENTION_MS, gameView } from '../core/game'
import { normalizeList } from '../core/list'
import type { GameView } from '../core/types'
import type { Repository } from '../db/repository'
import { createId, createToken, fingerprint } from './crypto'

/**
 * Every rule that keeps a game fair lives here or in `core/game`; the HTTP
 * surface only validates shapes and forwards. Failures throw a `Response` that
 * `rpc()` turns into a client-side error.
 */
export class BlindListsService {
  constructor(
    private readonly repository: Repository,
    private readonly clock: () => number = Date.now,
  ) {}

  createGame(input: { name: string; playerNames: string[] }) {
    const hostToken = createToken()
    this.repository.createGame({
      id: createId(),
      name: input.name.trim(),
      hostToken,
      createdAt: this.clock(),
      players: input.playerNames.map((name, index) => ({ id: createId(), name: name.trim(), seat: index + 1, token: createToken() })),
    })
    return { hostToken }
  }

  hostView(hostToken: string): GameView {
    const found = this.repository.gameByHostToken(hostToken)
    if (!found) throw notFound()
    return gameView(found.game, found.players, { kind: 'host' }, fingerprint)
  }

  playerView(playerToken: string): GameView {
    const found = this.repository.playerByToken(playerToken)
    if (!found) throw notFound()
    return gameView(found.game, found.players, { kind: 'player', playerId: found.player.id }, fingerprint)
  }

  sealList(playerToken: string, list: string): GameView {
    const text = normalizeList(list)
    if (!text) throw new Response('a list cannot be empty', { status: 400 })
    const result = this.repository.sealList({ token: playerToken, list: text, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    return this.playerView(playerToken)
  }

  dropPlayer(hostToken: string, playerId: string): GameView {
    const result = this.repository.dropPlayer({ hostToken, playerId, now: this.clock() })
    if (result === 'unknown') throw notFound()
    if (result === 'locked') throw locked()
    if (result === 'sealed') throw new Response('that player has already sealed a list', { status: 409 })
    if (result === 'too-few') throw new Response('a game needs at least two players', { status: 409 })
    return this.hostView(hostToken)
  }

  purgeExpiredGames() {
    return this.repository.deleteGamesCreatedBefore(this.clock() - RETENTION_MS)
  }
}

const notFound = () => new Response('this game has expired, or the link is wrong', { status: 404 })
const locked = () => new Response('the lists are revealed and locked', { status: 409 })
