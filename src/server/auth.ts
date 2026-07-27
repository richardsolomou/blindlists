import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { PASSWORD_MIN_LENGTH } from '../core/game'
import type { SealedListsDatabase } from '../db/connection'
import { schema } from '../db/schema'

/**
 * Kept beside the database so a self-hoster needs no configuration, and so
 * sessions survive a redeploy. Env wins when someone would rather manage it.
 */
export function authSecret(dataDirectory: string) {
  const fromEnv = process.env.AUTH_SECRET?.trim()
  if (fromEnv) return fromEnv
  const file = path.join(dataDirectory, 'auth.secret')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const secret = crypto.randomBytes(32).toString('base64url')
  fs.writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

export function createAuth(database: SealedListsDatabase, secret: string) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: 'sqlite', schema }),
    secret,
    baseURL: process.env.APP_URL?.trim() || undefined,
    emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN_LENGTH, autoSignIn: true },
    // Sign-in is the only thing worth brute forcing here, so it gets a tighter
    // bucket than the default.
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 90, updateAge: 60 * 60 * 24 },
    advanced: { useSecureCookies: (process.env.APP_URL ?? '').startsWith('https://') },
    trustedOrigins: (request) => {
      const forwarded = request ? forwardedOrigin(request) : undefined
      return forwarded ? [forwarded] : []
    },
  })
}

function forwardedOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host')?.trim()
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (!host || (protocol !== 'http' && protocol !== 'https')) return undefined
  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return undefined
  }
}
