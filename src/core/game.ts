export const PLAYERS_MIN = 2
export const PLAYERS_MAX = 16
export const NAME_MAX_LENGTH = 40
export const GAME_NAME_MAX_LENGTH = 80
export const LIST_MAX_LENGTH = 10_000

/** Games are deleted this long after they are created, so storage stays flat. */
export const RETENTION_DAYS = 30
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

export type GameStatus = 'collecting' | 'revealed'

export type GameRecord = {
  id: string
  name: string
  createdAt: number
  revealedAt: number | null
}

export type PlayerRecord = {
  id: string
  name: string
  seat: number
  token: string
  list: string | null
}

export type Viewer = { kind: 'host' } | { kind: 'player'; playerId: string }

export type PlayerView = {
  id: string
  name: string
  sealed: boolean
  /** Present only once the game is revealed, or for the viewer's own list. */
  list: string | null
  /** SHA-256 of the list above, derived on read rather than stored. */
  listHash: string | null
  /** The player's invite link secret, handed to the host so they can share it. */
  inviteToken: string | null
  isViewer: boolean
}

export type GameView = {
  name: string
  status: GameStatus
  sealed: number
  total: number
  players: PlayerView[]
}

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

/**
 * The exact bytes that get stored and hashed, so a player can reproduce the
 * fingerprint themselves: LF line endings, no trailing whitespace on any line,
 * no leading or trailing blank lines.
 */
export function normalizeList(text: string) {
  return text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

export function shortFingerprint(hash: string) {
  return hash.slice(0, 12)
}
