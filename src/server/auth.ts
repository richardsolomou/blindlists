import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { PASSWORD_MIN_LENGTH } from '../core/game'
import type { EmailDelivery } from '../adapters/email'
import type { SealedListsDatabase } from '../db/connection'
import { schema } from '../db/schema'
import { resetPasswordEmail, verifyEmail } from './emails'

export const SOCIAL_PROVIDERS = ['google', 'discord'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

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

/** A provider is offered only when both halves of its credential are present. */
export function configuredProviders(env: NodeJS.ProcessEnv = process.env): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((provider) => {
    const prefix = provider.toUpperCase()
    return Boolean(env[`${prefix}_CLIENT_ID`]?.trim() && env[`${prefix}_CLIENT_SECRET`]?.trim())
  })
}

function socialProviders(env: NodeJS.ProcessEnv) {
  const credentials = (provider: SocialProvider) => ({
    clientId: env[`${provider.toUpperCase()}_CLIENT_ID`] ?? '',
    clientSecret: env[`${provider.toUpperCase()}_CLIENT_SECRET`] ?? '',
  })
  const enabled = configuredProviders(env)
  return {
    ...(enabled.includes('google') ? { google: credentials('google') } : {}),
    ...(enabled.includes('discord') ? { discord: credentials('discord') } : {}),
  }
}

export function createAuth(database: SealedListsDatabase, secret: string, email: EmailDelivery) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: 'sqlite', schema }),
    secret,
    baseURL: process.env.APP_URL?.trim() || undefined,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        await email.send(resetPasswordEmail(user.email, url))
      },
    },
    // Unverified accounts can still play: the group already knows who each other
    // are, and blocking the first game on an inbox would be the wrong trade.
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await email.send(verifyEmail(user.email, url))
      },
    },
    socialProviders: socialProviders(process.env),
    // Signing in with Google to an account made with a password should land on
    // the same account, not a second one.
    account: { accountLinking: { enabled: true, trustedProviders: [...SOCIAL_PROVIDERS] } },
    /*
     * Limits are per IP, and a whole crew signing up shares one: six friends in
     * the same room on the same WiFi must not lock the last two out. Generous
     * enough for that, tight enough to make guessing a password pointless.
     */
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 20 },
        '/sign-up/email': { window: 60, max: 15 },
        '/forget-password': { window: 60, max: 5 },
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
