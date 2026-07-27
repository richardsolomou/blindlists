import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** A group of friends who play together. Its token is the durable link they share once. */
export const crews = sqliteTable(
  'crews',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    token: text('token').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('crews_token_unique').on(table.token)],
)

export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    crewId: text('crew_id')
      .notNull()
      .references(() => crews.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    seat: integer('seat').notNull(),
    /**
     * Set when someone leaves the crew. The row stays so their lists in games
     * that already revealed keep their name — deleting it would cascade those
     * entries away and quietly rewrite history.
     */
    removedAt: integer('removed_at'),
  },
  (table) => [index('members_crew_id_index').on(table.crewId)],
)

export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),
    crewId: text('crew_id')
      .notNull()
      .references(() => crews.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    createdAt: integer('created_at').notNull(),
    revealedAt: integer('revealed_at'),
  },
  (table) => [index('games_crew_id_index').on(table.crewId), index('games_created_at_index').on(table.createdAt)],
)

/** One player's slot in one game. The list stays null until they seal it. */
export const entries = sqliteTable(
  'entries',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    list: text('list'),
  },
  (table) => [uniqueIndex('entries_game_member_unique').on(table.gameId, table.memberId)],
)

export const schema = { crews, members, games, entries }
