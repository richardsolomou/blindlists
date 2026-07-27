import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../core/game'
import { authClient } from '../client/authClient'
import { ProviderButtons } from '../client/components/ProviderButtons'
import { signInOptionsQuery } from '../client/queries'

export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(signInOptionsQuery()),
  head: () => ({ meta: [{ title: 'Sign in — Sealed Lists' }] }),
  component: SignInPage,
})

function SignInPage() {
  const { next } = Route.useSearch()
  const { data: options } = useSuspenseQuery(signInOptionsQuery())
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signingUp = mode === 'sign-up'
  const ready = email.trim() && password.length >= PASSWORD_MIN_LENGTH && (!signingUp || name.trim())

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const result = signingUp
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'That did not work. Check the email and password and try again.')
      return
    }
    await queryClient.invalidateQueries()
    void navigate({ to: next ?? '/' })
  }

  return (
    <main className="mx-auto max-w-sm">
      <p className="eyebrow">{signingUp ? 'New here' : 'Welcome back'}</p>
      <h1 className="mt-2 text-3xl">{signingUp ? 'Make an account' : 'Sign in'}</h1>
      <p className="mt-2 mb-8 text-sm text-faint">
        {signingUp ? 'Your name is what the rest of your crew sees on a list.' : 'Your crews and your lists are waiting.'}
      </p>

      {options.providers.length > 0 && (
        <>
          <ProviderButtons providers={options.providers} next={next} />
          <div className="my-6 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-edge" />
            or
            <span className="h-px flex-1 bg-edge" />
          </div>
        </>
      )}

      <form className="space-y-4" onSubmit={submit}>
        {signingUp && (
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="field"
              value={name}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field"
            value={password}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
          {signingUp && <p className="mt-1.5 text-xs text-faint">At least {PASSWORD_MIN_LENGTH} characters.</p>}
        </div>
        <button type="submit" className="button-primary w-full" disabled={!ready || busy}>
          {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
        </button>
        {error && <p className="text-sm text-seal">{error}</p>}
      </form>

      <div className="mt-8 space-y-2 text-sm text-faint">
        <p>
          {signingUp ? 'Already have an account?' : 'No account yet?'}{' '}
          <button
            type="button"
            className="link-quiet"
            onClick={() => {
              setMode(signingUp ? 'sign-in' : 'sign-up')
              setError('')
            }}
          >
            {signingUp ? 'Sign in' : 'Make one'}
          </button>
        </p>
        {!signingUp && options.emailConfigured && (
          <p>
            <Link to="/forgot-password" className="link-quiet">
              Forgotten your password?
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
