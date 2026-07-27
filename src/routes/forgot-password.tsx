import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../client/authClient'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Reset your password — Sealed Lists' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Always report the same thing: whether an address has an account here is
  // nobody else's business.
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/reset-password' })
    setBusy(false)
    setSent(true)
  }

  return (
    <main className="mx-auto max-w-sm">
      <h1 className="text-3xl">Reset your password</h1>
      {sent ? (
        <p className="mt-3 text-faint">
          If <span className="text-parchment">{email.trim()}</span> has an account, a link is on its way. It stops working in an hour.
        </p>
      ) : (
        <>
          <p className="mt-2 mb-8 text-sm text-faint">Give us the address on your account and we will send a link.</p>
          <form className="space-y-4" onSubmit={submit}>
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
            <button type="submit" className="button-primary w-full" disabled={!email.trim() || busy}>
              {busy ? 'Sending…' : 'Send the link'}
            </button>
          </form>
        </>
      )}
    </main>
  )
}
