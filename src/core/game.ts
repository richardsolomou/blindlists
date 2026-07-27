import type { GameRecord, GameView, PlayerRecord, PlayerView, Viewer } from './types'

export const PLAYERS_MIN = 2
export const PLAYERS_MAX = 16
export const NAME_MAX_LENGTH = 40
export const GAME_NAME_MAX_LENGTH = 80

/** Games are deleted this long after they are created, so storage stays flat. */
export const RETENTION_DAYS = 30
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

export function allSealed(players: readonly PlayerRecord[]) {
  return players.length > 0 && players.every((player) => player.list !== null)
}

/**
 * The single place visibility is decided: before the reveal a viewer sees only
 * their own list, the host — who holds every invite link — sees no list content
 * at all, and invite links never reach another player. `fingerprint` is injected
 * so this file stays free of platform crypto.
 */
export function gameView(
  game: GameRecord,
  players: readonly PlayerRecord[],
  viewer: Viewer,
  fingerprint: (list: string) => string,
): GameView {
  const revealed = game.revealedAt !== null
  return {
    name: game.name,
    status: revealed ? 'revealed' : 'collecting',
    sealed: players.filter((player) => player.list !== null).length,
    total: players.length,
    expiresAt: game.createdAt + RETENTION_MS,
    players: players.map((player) => playerView(player, revealed, viewer, fingerprint)),
  }
}

function playerView(player: PlayerRecord, revealed: boolean, viewer: Viewer, fingerprint: (list: string) => string): PlayerView {
  const isViewer = viewer.kind === 'player' && viewer.playerId === player.id
  const list = revealed || isViewer ? player.list : null
  return {
    id: player.id,
    name: player.name,
    sealed: player.list !== null,
    list,
    listHash: list === null ? null : fingerprint(list),
    inviteToken: viewer.kind === 'host' ? player.token : null,
    isViewer,
  }
}

export function duplicateName(names: readonly string[]) {
  const seen = new Set<string>()
  for (const name of names) {
    const key = name.trim().toLocaleLowerCase()
    if (seen.has(key)) return name
    seen.add(key)
  }
  return undefined
}
