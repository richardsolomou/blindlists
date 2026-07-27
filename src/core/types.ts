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
  /** Present only once the game is revealed, or for the viewer's own submission. */
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
  /** When the whole game is deleted, so the pages can say so. */
  expiresAt: number
  players: PlayerView[]
}
