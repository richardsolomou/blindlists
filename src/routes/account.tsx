import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { NAME_MAX_LENGTH } from '../core/game'
import { authClient } from '../client/authClient'
import { emailPreferenceQuery, meQuery, signInOptionsQuery } from '../client/queries'
import { errorMessage } from '../client/queryClient'
import { setEmailPreference } from '../server/fns'

export const Route = createFileRoute('/account')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(meQuery()),
      context.queryClient.ensureQueryData(emailPreferenceQuery()),
      context.queryClient.ensureQueryData(signInOptionsQuery()),
    ]),
  head: () => ({ meta: [{ title: 'Account — Sealed Lists' }] }),
  component: AccountPage,
})

function AccountPage() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  const { data: preference } = useSuspenseQuery(emailPreferenceQuery())
  const { data: options } = useSuspenseQuery(signInOptionsQuery())
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const save = useMutation({
    mutationFn: (gameEmails: boolean) => setEmailPreference({ data: { gameEmails } }),
    onSuccess: (result) => {
      queryClient.setQueryData(emailPreferenceQuery().queryKey, result)
      toast.success(result.gameEmails ? 'Email on.' : 'Email off.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (!viewer) {
    return (
      <main>
        <h1 className="text-3xl">Sign in first</h1>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl">{viewer.name}</h1>
        <p className="mt-1.5 text-sm text-faint">{viewer.email}</p>
      </div>

      <YourName current={viewer.name} />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Email</CardTitle>
        </CardHeader>
        <CardContent>
          {options.emailConfigured ? (
            <div className="flex items-start justify-between gap-6">
              <div>
                <Label htmlFor="game-emails">Tell me about my games</Label>
                <p className="mt-1.5 text-sm text-faint">
                  When a game starts and your list is due, and when the last list comes in. Nothing else.
                </p>
              </div>
              <Switch
                id="game-emails"
                checked={preference?.gameEmails ?? true}
                disabled={save.isPending}
                onCheckedChange={(checked) => save.mutate(checked)}
              />
            </div>
          ) : (
            <p className="text-sm text-faint">This instance has no mail server, so it sends nothing.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">This device</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut()
              await queryClient.invalidateQueries()
              void navigate({ to: '/' })
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

/** The name everyone else reads next to your list, so it has to be fixable. */
function YourName({ current }: { current: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    const result = await authClient.updateUser({ name: trimmed })
    setBusy(false)
    if (result.error) {
      toast.error(result.error.message ?? 'That did not save.')
      return
    }
    // Names are read from the account everywhere, including in games already played.
    await queryClient.invalidateQueries()
    toast.success('Name saved.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Your name</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-sm text-faint">This is what the rest of your group sees next to your list.</p>
          </div>
          <Button type="submit" variant="outline" disabled={!trimmed || trimmed === current || busy}>
            {busy ? 'Saving…' : 'Save name'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
