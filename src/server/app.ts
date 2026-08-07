import path from 'node:path'
import { buildEmailDelivery } from '../adapters/email'
import { createCentrifugoPublisher, type RealtimePublisher } from '../adapters/centrifugo'
import { databasePath, openDatabase, type SealedListsDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { authSecret, createAuth } from './auth'
import { buildNotifier } from './notify'
import { SealedListsService } from './service'

type App = {
  database: SealedListsDatabase
  service: SealedListsService
  realtime: RealtimePublisher
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
    const realtime = createCentrifugoPublisher({
      apiKey: requiredEnvironment('CENTRIFUGO_API_KEY'),
      url: process.env.CENTRIFUGO_URL?.trim() || 'http://localhost:8000',
    })
    const service = new SealedListsService(repository, Date.now, buildNotifier(repository, email, appUrl), realtime)
    globalApp.sealedListsApp = {
      database,
      service,
      realtime,
      auth: createAuth(database, authSecret(path.dirname(file)), email),
      emailConfigured: email.configured,
    }
  }
  return globalApp.sealedListsApp
}

export function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}
