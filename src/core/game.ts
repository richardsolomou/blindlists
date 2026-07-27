export const PLAYERS_MIN = 2
export const MEMBERS_MAX = 16
export const GROUP_NAME_MAX_LENGTH = 60
export const NAME_MAX_LENGTH = 40
export const LIST_MAX_LENGTH = 10_000
export const PASSWORD_MIN_LENGTH = 10

export type GameStatus = 'collecting' | 'revealed'

export type GroupRecord = {
  id: string
  name: string
  token: string
  createdAt: number
}

/** Someone in the group. The name is their account name. */
export type GroupMember = {
  userId: string
  name: string
}

export type GameRecord = {
  id: string
  number: number
  createdAt: number
  revealedAt: number | null
}

/** One player's slot in one game, joined to their account name for display. */
export type EntryRecord = {
  userId: string
  name: string
  list: string | null
}

export type EntryView = {
  userId: string
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

export type GroupView = {
  name: string
  members: GroupMember[]
  /** False when the viewer holds the link but has not joined the group yet. */
  isMember: boolean
  /**
   * The game still collecting, or else the one that revealed most recently — so
   * a reveal appears on the page the group is already looking at instead of
   * vanishing into history.
   */
  currentGame: GameView | null
  pastGames: { id: string; number: number }[]
  /** False while a game is still collecting: a group runs one game at a time. */
  canStartGame: boolean
}

export type GroupSummary = {
  name: string
  token: string
  /** True when a game is collecting and the viewer still owes it a list. */
  needsList: boolean
}

/** A group always keeps enough people to field a game. */
export const canRemoveMember = (members: number) => members > PLAYERS_MIN

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
  const viewerEntry = entries.find((entry) => entry.userId === viewerId)
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
  const isViewer = entry.userId === viewerId
  return {
    userId: entry.userId,
    name: entry.name,
    sealed: entry.list !== null,
    list: revealed || isViewer ? entry.list : null,
    isViewer,
  }
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
