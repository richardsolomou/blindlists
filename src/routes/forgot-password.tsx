import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '../client/authClient'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Reset your password — Sealed Lists' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Always the same answer: whether an address has an account is nobody else's business.
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
        <p className="mt-4 text-faint">
          If <span className="text-parchment">{email.trim()}</span> has an account, a link is on the way. It works for an hour.
        </p>
      ) : (
        <>
          <p className="mt-2 mb-7 text-sm text-faint">We will email you a link.</p>
          <Card>
            <CardContent>
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={!email.trim() || busy}>
                  {busy ? 'Sending…' : 'Send the link'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
