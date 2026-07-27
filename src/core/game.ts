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

/** A crew always keeps enough people to field a game. */
export const canRemoveMember = (activeMembers: number) => activeMembers > MEMBERS_MIN

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
  /** Members who have not left the crew, in seat order. */
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
 * sealed state are public.
 */
export function gameView(game: GameRecord, entries: readonly EntryRecord[], viewerId: string | null): GameView {
  const revealed = game.revealedAt !== null
  const viewerEntry = entries.find((entry) => entry.memberId === viewerId)
  return {
    id: game.id,
    number: game.number,
    status: revealed ? 'revealed' : 'collecting',
    sealed: entries.filter((entry) => entry.list !== null).length,
    total: entries.length,
    entries: entries.map((entry) => entryView(entry, revealed, viewerId)),
    viewerSealed: viewerEntry ? viewerEntry.list !== null : null,
  }
}

function entryView(entry: EntryRecord, revealed: boolean, viewerId: string | null): EntryView {
  const isViewer = entry.memberId === viewerId
  return {
    memberId: entry.memberId,
    name: entry.name,
    sealed: entry.list !== null,
    list: revealed || isViewer ? entry.list : null,
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
 * The exact bytes that get stored: LF line endings, no trailing whitespace on
 * any line, no leading or trailing blank lines.
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
