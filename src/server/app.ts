import path from 'node:path'
import { databasePath, openDatabase, type SealedListsDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { authSecret, createAuth } from './auth'
import { SealedListsService } from './service'

type App = { database: SealedListsDatabase; service: SealedListsService; auth: ReturnType<typeof createAuth> }

const SWEEP_INTERVAL_MS = 60 * 60 * 1000

// Dev keeps the instance on globalThis so HMR reloads reuse one SQLite handle.
const globalApp = globalThis as typeof globalThis & { sealedListsApp?: App }

export function app(): App {
  if (!globalApp.sealedListsApp) {
    const file = databasePath()
    const database = openDatabase(file)
    const service = new SealedListsService(new Repository(database))
    globalApp.sealedListsApp = { database, service, auth: createAuth(database, authSecret(path.dirname(file))) }
    service.purgeExpiredGames()
    // Unreferenced so the timer never holds the process open on shutdown.
    setInterval(() => service.purgeExpiredGames(), SWEEP_INTERVAL_MS).unref()
  }
  return globalApp.sealedListsApp
}
