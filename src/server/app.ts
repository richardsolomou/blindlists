import { databasePath, openDatabase, type BlindListsDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { BlindListsService } from './service'

type App = { database: BlindListsDatabase; service: BlindListsService }

const SWEEP_INTERVAL_MS = 60 * 60 * 1000

// Dev keeps the instance on globalThis so HMR reloads reuse one SQLite handle.
const globalApp = globalThis as typeof globalThis & { blindListsApp?: App }

export function app(): App {
  if (!globalApp.blindListsApp) {
    const database = openDatabase(databasePath())
    const service = new BlindListsService(new Repository(database))
    globalApp.blindListsApp = { database, service }
    service.purgeExpiredGames()
    // Unreferenced so the timer never holds the process open on shutdown.
    setInterval(() => service.purgeExpiredGames(), SWEEP_INTERVAL_MS).unref()
  }
  return globalApp.blindListsApp
}
