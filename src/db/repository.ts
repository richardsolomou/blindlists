import { asc, eq, lt } from 'drizzle-orm'
import { PLAYERS_MIN, allSealed } from '../core/game'
import type { GameRecord, PlayerRecord } from '../core/types'
import type { BlindListsDatabase } from './connection'
import { games, players } from './schema'

export type NewGame = {
  id: string
  name: string
  hostToken: string
  createdAt: number
  players: { id: string; name: string; seat: number; token: string }[]
}

export type GameWithPlayers = { game: GameRecord; players: PlayerRecord[] }
export type PlayerContext = GameWithPlayers & { player: PlayerRecord }

export type SealResult = 'sealed' | 'locked' | 'unknown'
export type DropResult = 'dropped' | 'locked' | 'sealed' | 'too-few' | 'unknown'

export class Repository {
  constructor(private readonly database: BlindListsDatabase) {}

  createGame(game: NewGame) {
    this.database.transaction((tx) => {
      tx.insert(games).values({ id: game.id, name: game.name, hostToken: game.hostToken, createdAt: game.createdAt }).run()
      tx.insert(players)
        .values(game.players.map((player) => ({ ...player, gameId: game.id })))
        .run()
    })
  }

  gameByHostToken(hostToken: string): GameWithPlayers | undefined {
    const game = this.database.select().from(games).where(eq(games.hostToken, hostToken)).get()
    return game ? { game, players: this.playersOf(game.id) } : undefined
  }

  playerByToken(token: string): PlayerContext | undefined {
    const player = this.database.select().from(players).where(eq(players.token, token)).get()
    if (!player) return undefined
    const game = this.database.select().from(games).where(eq(games.id, player.gameId)).get()
    return game ? { game, player, players: this.playersOf(game.id) } : undefined
  }

  /** Stores a list, revealing the game in the same transaction when it was the last one outstanding. */
  sealList(input: { token: string; list: string; now: number }): SealResult {
    return this.database.transaction((tx) => {
      const player = tx.select().from(players).where(eq(players.token, input.token)).get()
      if (!player) return 'unknown'
      const game = tx.select().from(games).where(eq(games.id, player.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      tx.update(players).set({ list: input.list }).where(eq(players.id, player.id)).run()
      this.revealIfComplete(tx, game.id, input.now)
      return 'sealed'
    })
  }

  /** Lets the host clear a no-show, so one player never sealing cannot hold the reveal hostage. */
  dropPlayer(input: { hostToken: string; playerId: string; now: number }): DropResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.hostToken, input.hostToken)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const roster = this.playersOf(game.id, tx)
      const player = roster.find((entry) => entry.id === input.playerId)
      if (!player) return 'unknown'
      if (player.list !== null) return 'sealed'
      if (roster.length <= PLAYERS_MIN) return 'too-few'
      tx.delete(players).where(eq(players.id, player.id)).run()
      this.revealIfComplete(tx, game.id, input.now)
      return 'dropped'
    })
  }

  /** Retention sweep: a whole game disappears once it ages out, its players cascading with it. */
  deleteGamesCreatedBefore(cutoff: number) {
    return this.database.delete(games).where(lt(games.createdAt, cutoff)).run().changes
  }

  private revealIfComplete(tx: Transaction, gameId: string, now: number) {
    if (!allSealed(this.playersOf(gameId, tx))) return
    tx.update(games).set({ revealedAt: now }).where(eq(games.id, gameId)).run()
  }

  private playersOf(gameId: string, tx: Transaction | BlindListsDatabase = this.database): PlayerRecord[] {
    return tx.select().from(players).where(eq(players.gameId, gameId)).orderBy(asc(players.seat)).all()
  }
}

type Transaction = Parameters<Parameters<BlindListsDatabase['transaction']>[0]>[0]
