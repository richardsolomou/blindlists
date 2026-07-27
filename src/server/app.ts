import path from 'node:path'
import { buildEmailDelivery } from '../adapters/email'
import { createGroupEvents, type GroupEvents } from '../adapters/events'
import { databasePath, openDatabase, type SealedListsDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { authSecret, createAuth } from './auth'
import { buildNotifier } from './notify'
import { SealedListsService } from './service'

type App = {
  database: SealedListsDatabase
  service: SealedListsService
  events: GroupEvents
  auth: ReturnType<typeof createAuth>
  emailConfigured: boolean
}

const appUrl = () => process.env.APP_URL?.trim() || 'http://localhost:3000'

// Dev keeps the instance on globalThis so HMR reloads reuse one SQLite handle.
const globalApp = globalThis as typeof globalThis & { sealedListsApp?: App }

export function app(): App {
  if (!globalApp.sealedListsApp) {
    const file = databasePath()
    const database = openDatabase(file)
    const repository = new Repository(database)
    const email = buildEmailDelivery()
    const events = createGroupEvents()
    const service = new SealedListsService(repository, Date.now, buildNotifier(repository, email, appUrl), events)
    globalApp.sealedListsApp = {
      database,
      service,
      events,
      auth: createAuth(database, authSecret(path.dirname(file)), email),
      emailConfigured: email.configured,
    }
  }
  return globalApp.sealedListsApp
}
