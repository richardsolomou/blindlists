import { useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { PASSWORD_MIN_LENGTH } from '../core/game'
import { authClient } from '../client/authClient'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: 'Set a new password — Sealed Lists' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!token) {
    return (
      <main className="mx-auto max-w-sm">
        <h1 className="text-3xl">That link is incomplete</h1>
        <p className="mt-3 text-faint">
          Open the link from the email again, or{' '}
          <Link to="/forgot-password" className="link-quiet">
            ask for a new one
          </Link>
          .
        </p>
      </main>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const result = await authClient.resetPassword({ newPassword: password, token })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'That link has expired. Ask for a new one.')
      return
    }
    await queryClient.invalidateQueries()
    void navigate({ to: '/signin' })
  }

  return (
    <main className="mx-auto max-w-sm">
      <h1 className="text-3xl">Set a new password</h1>
      <p className="mt-2 mb-8 text-sm text-faint">At least {PASSWORD_MIN_LENGTH} characters.</p>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            className="field"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" className="button-primary w-full" disabled={password.length < PASSWORD_MIN_LENGTH || busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        {error && <p className="text-sm text-seal">{error}</p>}
      </form>
    </main>
  )
}
