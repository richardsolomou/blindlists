import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../core/game'
import { authClient } from '../client/authClient'

export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const { next } = Route.useSearch()
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
      setError(result.error.message ?? 'that did not work')
      return
    }
    await queryClient.invalidateQueries()
    void navigate({ to: next ?? '/' })
  }

  return (
    <main className="mx-auto max-w-sm">
      <h1 className="text-3xl">{signingUp ? 'Make an account' : 'Sign in'}</h1>
      <p className="mt-2 mb-8 text-sm text-faint">{signingUp ? 'Your name is what the rest of your crew sees.' : 'Welcome back.'}</p>

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
          {signingUp && <p className="mt-1 text-xs text-faint">At least {PASSWORD_MIN_LENGTH} characters.</p>}
        </div>
        <button type="submit" className="button-primary" disabled={!ready || busy}>
          {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
        </button>
        {error && <p className="text-sm text-seal">{error}</p>}
      </form>

      <p className="mt-8 text-sm text-faint">
        {signingUp ? 'Already have an account?' : 'No account yet?'}{' '}
        <button
          type="button"
          className="underline hover:text-brass"
          onClick={() => {
            setMode(signingUp ? 'sign-in' : 'sign-up')
            setError('')
          }}
        >
          {signingUp ? 'Sign in' : 'Make one'}
        </button>
      </p>
    </main>
  )
}
