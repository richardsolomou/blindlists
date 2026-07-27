import { and, asc, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { MEMBERS_MAX, allSealed } from '../core/game'
import type { CrewRecord, EntryRecord, GameRecord, MemberRecord } from '../core/game'
import type { SealedListsDatabase } from './connection'
import { crews, entries, games, members } from './schema'

export type NewCrew = {
  id: string
  name: string
  token: string
  createdAt: number
  members: MemberRecord[]
}

type Crew = { crew: CrewRecord; members: MemberRecord[] }

type SealResult = 'sealed' | 'locked' | 'unknown'
type DropResult = 'dropped' | 'locked' | 'sealed' | 'too-few' | 'unknown'
type AddMemberResult = 'added' | 'full'
type JoinResult = 'joined' | 'locked' | 'already-in' | 'unknown'
type RemoveMemberResult = 'removed' | 'too-few' | 'unknown'

export class Repository {
  constructor(private readonly database: SealedListsDatabase) {}

  createCrew(crew: NewCrew) {
    this.database.transaction((tx) => {
      tx.insert(crews).values({ id: crew.id, name: crew.name, token: crew.token, createdAt: crew.createdAt }).run()
      tx.insert(members)
        .values(crew.members.map((member) => ({ ...member, crewId: crew.id })))
        .run()
    })
  }

  crewByToken(token: string): Crew | undefined {
    const crew = this.database.select().from(crews).where(eq(crews.token, token)).get()
    return crew ? { crew, members: this.membersOf(crew.id) } : undefined
  }

  addMember(input: { crewId: string; id: string; name: string }): AddMemberResult {
    return this.database.transaction((tx) => {
      const roster = this.membersOf(input.crewId, tx)
      if (roster.length >= MEMBERS_MAX) return 'full'
      const seat = this.highestSeat(input.crewId, tx) + 1
      tx.insert(members).values({ id: input.id, crewId: input.crewId, name: input.name, seat }).run()
      return 'added'
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
  createGame(input: { id: string; crewId: string; memberIds: string[]; now: number }): GameRecord | 'in-progress' {
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
      const game = {
        id: input.id,
        crewId: input.crewId,
        number: (highest?.number ?? 0) + 1,
        createdAt: input.now,
        revealedAt: null,
      }
      tx.insert(games).values(game).run()
      tx.insert(entries)
        .values(input.memberIds.map((memberId) => ({ gameId: game.id, memberId, list: null })))
        .run()
      return game
    })
  }

  /** Stores a list, revealing the game in the same transaction when it was the last one outstanding. */
  sealList(input: { gameId: string; memberId: string; list: string; now: number }): SealResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.id, input.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const entry = tx
        .select()
        .from(entries)
        .where(and(eq(entries.gameId, input.gameId), eq(entries.memberId, input.memberId)))
        .get()
      if (!entry) return 'unknown'
      tx.update(entries)
        .set({ list: input.list })
        .where(and(eq(entries.gameId, input.gameId), eq(entries.memberId, input.memberId)))
        .run()
      this.revealIfComplete(tx, input.gameId, input.now)
      return 'sealed'
    })
  }

  /** Puts a crew member into the game that is already collecting. */
  joinGame(input: { gameId: string; memberId: string; now: number }): JoinResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.id, input.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const existing = tx
        .select()
        .from(entries)
        .where(and(eq(entries.gameId, input.gameId), eq(entries.memberId, input.memberId)))
        .get()
      if (existing) return 'already-in'
      tx.insert(entries).values({ gameId: input.gameId, memberId: input.memberId, list: null }).run()
      return 'joined'
    })
  }

  /**
   * Marks someone as having left the crew. Their entries in games that already
   * revealed stay exactly as they were; only a game still collecting loses them.
   */
  removeMember(input: { crewId: string; memberId: string; now: number }): RemoveMemberResult {
    return this.database.transaction((tx) => {
      const roster = this.membersOf(input.crewId, tx)
      if (!roster.some((member) => member.id === input.memberId)) return 'unknown'
      if (roster.length <= 2) return 'too-few'
      const collecting = tx
        .select()
        .from(games)
        .where(and(eq(games.crewId, input.crewId), isNull(games.revealedAt)))
        .get()
      if (collecting) {
        tx.delete(entries)
          .where(and(eq(entries.gameId, collecting.id), eq(entries.memberId, input.memberId)))
          .run()
      }
      tx.update(members).set({ removedAt: input.now }).where(eq(members.id, input.memberId)).run()
      if (collecting) this.revealIfComplete(tx, collecting.id, input.now)
      return 'removed'
    })
  }

  /** Clears a no-show, so one player never sealing cannot hold the reveal hostage. */
  dropEntry(input: { gameId: string; memberId: string; now: number }): DropResult {
    return this.database.transaction((tx) => {
      const game = tx.select().from(games).where(eq(games.id, input.gameId)).get()
      if (!game) return 'unknown'
      if (game.revealedAt !== null) return 'locked'
      const roster = this.entriesQuery(input.gameId, tx)
      const entry = roster.find((candidate) => candidate.memberId === input.memberId)
      if (!entry) return 'unknown'
      if (entry.list !== null) return 'sealed'
      if (roster.length <= 2) return 'too-few'
      tx.delete(entries)
        .where(and(eq(entries.gameId, input.gameId), eq(entries.memberId, input.memberId)))
        .run()
      this.revealIfComplete(tx, input.gameId, input.now)
      return 'dropped'
    })
  }

  /** Retention sweep: a whole game disappears once it ages out, its entries cascading with it. */
  deleteGamesCreatedBefore(cutoff: number) {
    return this.database.delete(games).where(lt(games.createdAt, cutoff)).run().changes
  }

  private revealIfComplete(tx: Transaction, gameId: string, now: number) {
    if (!allSealed(this.entriesQuery(gameId, tx))) return
    tx.update(games).set({ revealedAt: now }).where(eq(games.id, gameId)).run()
  }

  private entriesQuery(gameId: string, tx: Transaction | SealedListsDatabase = this.database): EntryRecord[] {
    return tx
      .select({ memberId: entries.memberId, name: members.name, seat: members.seat, list: entries.list })
      .from(entries)
      .innerJoin(members, eq(members.id, entries.memberId))
      .where(eq(entries.gameId, gameId))
      .orderBy(asc(members.seat))
      .all()
  }

  private membersOf(crewId: string, tx: Transaction | SealedListsDatabase = this.database): MemberRecord[] {
    return tx
      .select({ id: members.id, name: members.name, seat: members.seat })
      .from(members)
      .where(and(eq(members.crewId, crewId), isNull(members.removedAt)))
      .orderBy(asc(members.seat))
      .all()
  }

  /** Seats are never reused, so a new member always sits after everyone who has ever been in the crew. */
  private highestSeat(crewId: string, tx: Transaction | SealedListsDatabase = this.database) {
    return (
      tx
        .select({ seat: sql<number>`max(${members.seat})` })
        .from(members)
        .where(eq(members.crewId, crewId))
        .get()?.seat ?? 0
    )
  }
}

type Transaction = Parameters<Parameters<SealedListsDatabase['transaction']>[0]>[0]
