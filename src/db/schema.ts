import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    hostToken: text('host_token').notNull(),
    createdAt: integer('created_at').notNull(),
    revealedAt: integer('revealed_at'),
  },
  (table) => [uniqueIndex('games_host_token_unique').on(table.hostToken), index('games_created_at_index').on(table.createdAt)],
)

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    seat: integer('seat').notNull(),
    token: text('token').notNull(),
    list: text('list'),
  },
  (table) => [uniqueIndex('players_token_unique').on(table.token), index('players_game_id_index').on(table.gameId)],
)

export const schema = { games, players }
