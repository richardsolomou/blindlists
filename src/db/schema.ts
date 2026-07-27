import { customType, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** better-auth stores its dates as ISO strings. */
const isoDate = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  fromDriver: (value) => new Date(value),
  toDriver: (value) => value.toISOString(),
})

// The tables better-auth owns. Their shapes are dictated by better-auth, so
// product columns do not belong here.

export const user = sqliteTable('user', {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: 'boolean' }).notNull(),
  image: text(),
  createdAt: isoDate().notNull(),
  updatedAt: isoDate().notNull(),
})

export const session = sqliteTable(
  'session',
  {
    id: text().primaryKey().notNull(),
    expiresAt: isoDate().notNull(),
    token: text().notNull().unique(),
    createdAt: isoDate().notNull(),
    updatedAt: isoDate().notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: isoDate(),
    refreshTokenExpiresAt: isoDate(),
    scope: text(),
    password: text(),
    createdAt: isoDate().notNull(),
    updatedAt: isoDate().notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: isoDate().notNull(),
    createdAt: isoDate().notNull(),
    updatedAt: isoDate().notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const rateLimit = sqliteTable(
  'rateLimit',
  {
    id: text().primaryKey().notNull(),
    key: text().notNull().unique(),
    count: integer().notNull(),
    lastRequest: integer().notNull(),
  },
  (table) => [index('rateLimit_key_idx').on(table.key)],
)

/** A group of friends who play together. Its token is the link they share once. */
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

export const crewMembers = sqliteTable(
  'crew_members',
  {
    crewId: text('crew_id')
      .notNull()
      .references(() => crews.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: integer('joined_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.crewId, table.userId] }), index('crew_members_user_id_index').on(table.userId)],
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
  (table) => [index('games_crew_id_index').on(table.crewId)],
)

/** Whether we may email someone about their games. Absent row means yes. */
export const emailPreferences = sqliteTable('email_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  gameEmails: integer('game_emails', { mode: 'boolean' }).notNull(),
})

/**
 * One player's slot in one game, keyed to the account rather than to crew
 * membership: leaving a crew must not erase your lists from games that have
 * already revealed.
 */
export const entries = sqliteTable(
  'entries',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    list: text('list'),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.userId] })],
)

export const schema = { user, session, account, verification, rateLimit, crews, crewMembers, games, entries, emailPreferences }
