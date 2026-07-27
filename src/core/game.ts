export const MEMBERS_MIN = 2
export const MEMBERS_MAX = 16
export const NAME_MAX_LENGTH = 40
export const CREW_NAME_MAX_LENGTH = 60
export const LIST_MAX_LENGTH = 10_000

/** Games are deleted this long after they are created, so storage stays flat. */
export const RETENTION_DAYS = 30
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

export type GameStatus = 'collecting' | 'revealed'

export type CrewRecord = {
  id: string
  name: string
  token: string
  createdAt: number
}

export type MemberRecord = {
  id: string
  name: string
  seat: number
}

export type GameRecord = {
  id: string
  number: number
  createdAt: number
  revealedAt: number | null
}

/** One player's slot in one game, joined to the member's name for display. */
export type EntryRecord = {
  memberId: string
  name: string
  seat: number
  list: string | null
}

export type EntryView = {
  memberId: string
  name: string
  sealed: boolean
  /** Present only once the game is revealed, or for the viewer's own list. */
  list: string | null
  /** SHA-256 of the list above, derived on read rather than stored. */
  listHash: string | null
  isViewer: boolean
}

export type GameView = {
  id: string
  number: number
  status: GameStatus
  sealed: number
  total: number
  entries: EntryView[]
  /** Null when the viewer is not playing in this game. */
  viewerSealed: boolean | null
}

export type CrewView = {
  name: string
  members: MemberRecord[]
  /** Null until the visitor has tapped their name on this device. */
  viewer: MemberRecord | null
  /**
   * The game still collecting, or else the one that revealed most recently — so
   * the reveal appears on the page the crew is already looking at instead of
   * vanishing into history.
   */
  currentGame: GameView | null
  pastGames: { id: string; number: number }[]
  /** False while a game is still collecting: a crew runs one game at a time. */
  canStartGame: boolean
}

export function allSealed(entries: readonly EntryRecord[]) {
  return entries.length > 0 && entries.every((entry) => entry.list !== null)
}

/**
 * The single place visibility is decided: before the reveal a viewer sees only
 * their own list, and everyone else's is withheld even though their names and
 * sealed state are public. `fingerprint` is injected so this file stays free of
 * platform crypto.
 */
export function gameView(
  game: GameRecord,
  entries: readonly EntryRecord[],
  viewerId: string | null,
  fingerprint: (list: string) => string,
): GameView {
  const revealed = game.revealedAt !== null
  const viewerEntry = entries.find((entry) => entry.memberId === viewerId)
  return {
    id: game.id,
    number: game.number,
    status: revealed ? 'revealed' : 'collecting',
    sealed: entries.filter((entry) => entry.list !== null).length,
    total: entries.length,
    entries: entries.map((entry) => entryView(entry, revealed, viewerId, fingerprint)),
    viewerSealed: viewerEntry ? viewerEntry.list !== null : null,
  }
}

function entryView(entry: EntryRecord, revealed: boolean, viewerId: string | null, fingerprint: (list: string) => string): EntryView {
  const isViewer = entry.memberId === viewerId
  const list = revealed || isViewer ? entry.list : null
  return {
    memberId: entry.memberId,
    name: entry.name,
    sealed: entry.list !== null,
    list,
    listHash: list === null ? null : fingerprint(list),
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
