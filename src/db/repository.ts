import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { MEMBERS_MAX, allSealed } from '../core/game'
import type { CrewMember, CrewRecord, EntryRecord, GameRecord } from '../core/game'
import type { SealedListsDatabase } from './connection'
import { crewMembers, crews, emailPreferences, entries, games, user } from './schema'

type Crew = { crew: CrewRecord; members: CrewMember[] }

type JoinCrewResult = 'joined' | 'already-in' | 'full'
type SealResult = 'sealed' | 'locked' | 'unknown'
type DropResult = 'dropped' | 'locked' | 'sealed' | 'too-few' | 'unknown'
type JoinGameResult = 'joined' | 'locked' | 'already-in' | 'unknown'
type RemoveMemberResult = 'removed' | 'unknown' | 'too-few'

export class Repository {
  constructor(private readonly database: SealedListsDatabase) {}

  createCrew(crew: { id: string; name: string; token: string; ownerId: string; now: number }) {
    this.database.transaction((tx) => {
      tx.insert(crews).values({ id: crew.id, name: crew.name, token: crew.token, createdAt: crew.now }).run()
      tx.insert(crewMembers).values({ crewId: crew.id, userId: crew.ownerId, joinedAt: crew.now }).run()
    })
  }

  crewByToken(token: string): Crew | undefined {
    const crew = this.database.select().from(crews).where(eq(crews.token, token)).get()
    return crew ? { crew, members: this.membersOf(crew.id) } : undefined
  }

  /** Every crew the user belongs to, newest first. */
  crewsOf(userId: string) {
    return this.database
      .select({ id: crews.id, name: crews.name, token: crews.token })
      .from(crewMembers)
      .innerJoin(crews, eq(crews.id, crewMembers.crewId))
      .where(eq(crewMembers.userId, userId))
      .orderBy(desc(crews.createdAt))
      .all()
  }

  joinCrew(input: { crewId: string; userId: string; now: number }): JoinCrewResult {
    return this.database.transaction((tx) => {
      const roster = this.membersOf(input.crewId, tx)
      if (roster.some((member) => member.userId === input.userId)) return 'already-in'
      if (roster.length >= MEMBERS_MAX) return 'full'
      tx.insert(crewMembers).values({ crewId: input.crewId, userId: input.userId, joinedAt: input.now }).run()
      return 'joined'
    })
  }

  /**
   * Takes someone out of the crew, and out of a game still collecting. Entries
   * are keyed to the account rather than to membership, so their lists in games
   * that already revealed stay exactly as they were.
   */
  removeMember(input: { crewId: string; userId: string; now: number }): RemoveMemberResult {
    return this.database.transaction((tx) => {
      const roster = this.membersOf(input.crewId, tx)
      if (!roster.some((member) => member.userId === input.userId)) return 'unknown'
      if (roster.length <= 2) return 'too-few'
      const collecting = tx
        .select()
        .from(games)
        .where(and(eq(games.crewId, input.crewId), isNull(games.revealedAt)))
        .get()
      if (collecting) {
        tx.delete(entries)
          .where(and(eq(entries.gameId, collecting.id), eq(entries.userId, input.userId)))
          .run()
      }
      tx.delete(crewMembers)
        .where(and(eq(crewMembers.crewId, input.crewId), eq(crewMembers.userId, input.userId)))
        .run()
      if (collecting) this.revealIfComplete(tx, collecting.id, input.now)
      return 'removed'
    })
  }

  /** The one game still collecting, which is the crew's current game. */
  activeGame(crewId: string): GameRecord | undefined {
    return this.database
      .select()
      .from(games)
      .where(and(eq(games.crewId, crewId), isNull(games.revealedAt)))
      .get()
  }

  revealedGames(crewId: string): GameRecord[] {
    return this.database
      .select()
      .from(games)
      .where(and(eq(games.crewId, crewId), isNotNull(games.revealedAt)))
      .orderBy(desc(games.number))
      .all()
  }

  gameById(crewId: string, gameId: string): GameRecord | undefined {
    return this.database
      .select()
      .from(games)
      .where(and(eq(games.crewId, crewId), eq(games.id, gameId)))
      .get()
  }

  entriesOf(gameId: string): EntryRecord[] {
    return this.entriesQuery(gameId)
  }

  /** Refuses a second concurrent game so a crew always has exactly one current game. */
  createGame(input: { id: string; crewId: string; userIds: string[]; now: number }): GameRecord | 'in-progress' {
    return this.database.transaction((tx) => {
      const existing = tx
        .select()
        .from(games)
        .where(and(eq(games.crewId, input.crewId), isNull(games.revealedAt)))
        .get()
      if (existing) return 'in-progress'
      const highest = tx
        .select({ number: sql<number>`max(${games.number})` })
        .from(games)
        .where(eq(games.crewId, input.crewId))
        .get()
      const game = { id: input.id, crewId: input.crewId, number: (highest?.number ?? 0) + 1, createdAt: input.now, revealedAt: null }
      tx.insert(games).values(game).run()
      tx.insert(entries)
        .values(input.userIds.map((userId) => ({ gameId: game.id, userId, list: null })))
        .run()
      return game
    })
  }

  /** Stores a list, revealing the game in the same transaction when it was the last one outstanding. */
  sealList(input: { gameId: string; userId: string; list: string; now: number }): SealResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.id, input.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const entry = tx
        .select()
        .from(entries)
        .where(and(eq(entries.gameId, input.gameId), eq(entries.userId, input.userId)))
        .get()
      if (!entry) return 'unknown'
      tx.update(entries)
        .set({ list: input.list })
        .where(and(eq(entries.gameId, input.gameId), eq(entries.userId, input.userId)))
        .run()
      this.revealIfComplete(tx, input.gameId, input.now)
      return 'sealed'
    })
  }

  /** Puts a crew member into the game that is already collecting. */
  joinGame(input: { gameId: string; userId: string; now: number }): JoinGameResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.id, input.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const existing = tx
        .select()
        .from(entries)
        .where(and(eq(entries.gameId, input.gameId), eq(entries.userId, input.userId)))
        .get()
      if (existing) return 'already-in'
      tx.insert(entries).values({ gameId: input.gameId, userId: input.userId, list: null }).run()
      return 'joined'
    })
  }

  /** Clears a no-show, so one player never sealing cannot hold the reveal hostage. */
  dropEntry(input: { gameId: string; userId: string; now: number }): DropResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.id, input.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const roster = this.entriesQuery(input.gameId, tx)
      const entry = roster.find((candidate) => candidate.userId === input.userId)
      if (!entry) return 'unknown'
      if (entry.list !== null) return 'sealed'
      if (roster.length <= 2) return 'too-few'
      tx.delete(entries)
        .where(and(eq(entries.gameId, input.gameId), eq(entries.userId, input.userId)))
        .run()
      this.revealIfComplete(tx, input.gameId, input.now)
      return 'dropped'
    })
  }

  /** Everyone in a game who has said yes to email, minus one person to skip. */
  mailableInGame(gameId: string, except?: string) {
    return this.database
      .select({ userId: user.id, name: user.name, email: user.email, gameEmails: emailPreferences.gameEmails })
      .from(entries)
      .innerJoin(user, eq(user.id, entries.userId))
      .leftJoin(emailPreferences, eq(emailPreferences.userId, entries.userId))
      .where(eq(entries.gameId, gameId))
      .all()
      .filter((row) => row.gameEmails !== false && row.userId !== except)
      .map((row) => ({ userId: row.userId, name: row.name, email: row.email }))
  }

  gameEmails(userId: string) {
    return this.database.select().from(emailPreferences).where(eq(emailPreferences.userId, userId)).get()?.gameEmails ?? true
  }

  setGameEmails(userId: string, gameEmails: boolean) {
    this.database
      .insert(emailPreferences)
      .values({ userId, gameEmails })
      .onConflictDoUpdate({ target: emailPreferences.userId, set: { gameEmails } })
      .run()
  }

  crewOfGame(gameId: string) {
    return this.database
      .select({ id: crews.id, name: crews.name, token: crews.token })
      .from(games)
      .innerJoin(crews, eq(crews.id, games.crewId))
      .where(eq(games.id, gameId))
      .get()
  }

  private revealIfComplete(tx: Transaction, gameId: string, now: number) {
    if (!allSealed(this.entriesQuery(gameId, tx))) return
    tx.update(games).set({ revealedAt: now }).where(eq(games.id, gameId)).run()
  }

  private entriesQuery(gameId: string, tx: Transaction | SealedListsDatabase = this.database): EntryRecord[] {
    return tx
      .select({ userId: entries.userId, name: user.name, list: entries.list })
      .from(entries)
      .innerJoin(user, eq(user.id, entries.userId))
      .where(eq(entries.gameId, gameId))
      .orderBy(asc(user.name))
      .all()
  }

  private membersOf(crewId: string, tx: Transaction | SealedListsDatabase = this.database): CrewMember[] {
    return tx
      .select({ userId: crewMembers.userId, name: user.name })
      .from(crewMembers)
      .innerJoin(user, eq(user.id, crewMembers.userId))
      .where(eq(crewMembers.crewId, crewId))
      .orderBy(asc(user.name))
      .all()
  }
}

type Transaction = Parameters<Parameters<SealedListsDatabase['transaction']>[0]>[0]
