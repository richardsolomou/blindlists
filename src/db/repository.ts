import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { MEMBERS_MAX, MEMBERS_MIN, allSealed } from '../core/game'
import type { GroupMember, GroupRecord, EntryRecord, GameRecord } from '../core/game'
import type { SealedListsDatabase } from './connection'
import { groupMembers, groups, emailPreferences, entries, games, user } from './schema'

type Group = { group: GroupRecord; members: GroupMember[] }

type JoinGroupResult = 'joined' | 'already-in' | 'full'
type SealResult = 'sealed' | 'locked' | 'unknown'
type DropResult = 'dropped' | 'locked' | 'sealed' | 'too-few' | 'unknown'
type JoinGameResult = 'joined' | 'locked' | 'already-in' | 'unknown'
type RemoveMemberResult = 'removed' | 'unknown' | 'too-few'

export class Repository {
  constructor(private readonly database: SealedListsDatabase) {}

  createGroup(group: { id: string; name: string; token: string; ownerId: string; now: number }) {
    this.database.transaction((tx) => {
      tx.insert(groups).values({ id: group.id, name: group.name, token: group.token, createdAt: group.now }).run()
      tx.insert(groupMembers).values({ groupId: group.id, userId: group.ownerId, joinedAt: group.now }).run()
    })
  }

  groupByToken(token: string): Group | undefined {
    const group = this.database.select().from(groups).where(eq(groups.token, token)).get()
    return group ? { group, members: this.membersOf(group.id) } : undefined
  }

  /** Every group the user belongs to, newest first. */
  groupsOf(userId: string) {
    return this.database
      .select({ id: groups.id, name: groups.name, token: groups.token })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId))
      .orderBy(desc(groups.createdAt))
      .all()
  }

  joinGroup(input: { groupId: string; userId: string; now: number }): JoinGroupResult {
    return this.database.transaction((tx) => {
      const roster = this.membersOf(input.groupId, tx)
      if (roster.some((member) => member.userId === input.userId)) return 'already-in'
      if (roster.length >= MEMBERS_MAX) return 'full'
      tx.insert(groupMembers).values({ groupId: input.groupId, userId: input.userId, joinedAt: input.now }).run()
      return 'joined'
    })
  }

  /**
   * Takes someone out of the group, and out of a game still collecting. Entries
   * are keyed to the account rather than to membership, so their lists in games
   * that already revealed stay exactly as they were.
   */
  removeMember(input: { groupId: string; userId: string; now: number }): RemoveMemberResult {
    return this.database.transaction((tx) => {
      const roster = this.membersOf(input.groupId, tx)
      if (!roster.some((member) => member.userId === input.userId)) return 'unknown'
      if (roster.length <= MEMBERS_MIN) return 'too-few'
      const collecting = tx
        .select()
        .from(games)
        .where(and(eq(games.groupId, input.groupId), isNull(games.revealedAt)))
        .get()
      if (collecting) {
        tx.delete(entries)
          .where(and(eq(entries.gameId, collecting.id), eq(entries.userId, input.userId)))
          .run()
      }
      tx.delete(groupMembers)
        .where(and(eq(groupMembers.groupId, input.groupId), eq(groupMembers.userId, input.userId)))
        .run()
      if (collecting) this.revealIfComplete(tx, collecting.id, input.now)
      return 'removed'
    })
  }

  /** The one game still collecting, which is the group's current game. */
  activeGame(groupId: string): GameRecord | undefined {
    return this.database
      .select()
      .from(games)
      .where(and(eq(games.groupId, groupId), isNull(games.revealedAt)))
      .get()
  }

  revealedGames(groupId: string): GameRecord[] {
    return this.database
      .select()
      .from(games)
      .where(and(eq(games.groupId, groupId), isNotNull(games.revealedAt)))
      .orderBy(desc(games.number))
      .all()
  }

  gameById(groupId: string, gameId: string): GameRecord | undefined {
    return this.database
      .select()
      .from(games)
      .where(and(eq(games.groupId, groupId), eq(games.id, gameId)))
      .get()
  }

  entriesOf(gameId: string): EntryRecord[] {
    return this.entriesQuery(gameId)
  }

  /** Throws the game away, lists and all: `entries` cascades off `games`. */
  deleteGame(input: { groupId: string; gameId: string }): 'deleted' | 'unknown' {
    const removed = this.database
      .delete(games)
      .where(and(eq(games.groupId, input.groupId), eq(games.id, input.gameId)))
      .run()
    return removed.changes > 0 ? 'deleted' : 'unknown'
  }

  /** Refuses a second concurrent game so a group always has exactly one current game. */
  createGame(input: { id: string; groupId: string; userIds: string[]; now: number }): GameRecord | 'in-progress' {
    return this.database.transaction((tx) => {
      const existing = tx
        .select()
        .from(games)
        .where(and(eq(games.groupId, input.groupId), isNull(games.revealedAt)))
        .get()
      if (existing) return 'in-progress'
      const highest = tx
        .select({ number: sql<number>`max(${games.number})` })
        .from(games)
        .where(eq(games.groupId, input.groupId))
        .get()
      const game = { id: input.id, groupId: input.groupId, number: (highest?.number ?? 0) + 1, createdAt: input.now, revealedAt: null }
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

  /** Puts a group member into the game that is already collecting. */
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

  groupOfGame(gameId: string) {
    return this.database
      .select({ id: groups.id, name: groups.name, token: groups.token })
      .from(games)
      .innerJoin(groups, eq(groups.id, games.groupId))
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

  private membersOf(groupId: string, tx: Transaction | SealedListsDatabase = this.database): GroupMember[] {
    return tx
      .select({ userId: groupMembers.userId, name: user.name })
      .from(groupMembers)
      .innerJoin(user, eq(user.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(user.name))
      .all()
  }
}

type Transaction = Parameters<Parameters<SealedListsDatabase['transaction']>[0]>[0]
