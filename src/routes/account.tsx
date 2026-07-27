import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
  head: () => ({ meta: [{ title: 'Your account — Sealed Lists' }] }),
  component: AccountPage,
})

function AccountPage() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  const { data: preference } = useSuspenseQuery(emailPreferenceQuery())
  const { data: options } = useSuspenseQuery(signInOptionsQuery())
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const preferenceMutation = useMutation({
    mutationFn: (gameEmails: boolean) => setEmailPreference({ data: { gameEmails } }),
    onSuccess: (result) => queryClient.setQueryData(emailPreferenceQuery().queryKey, result),
  })

  if (!viewer) {
    return (
      <main>
        <h1 className="text-3xl">Sign in first</h1>
      </main>
    )
  }

  const gameEmails = preference?.gameEmails ?? true

  return (
    <main className="space-y-10">
      <header>
        <p className="eyebrow">Your account</p>
        <h1 className="mt-2 text-3xl">{viewer.name}</h1>
        <p className="mt-1 text-sm text-faint">{viewer.email}</p>
      </header>

      <section>
        <h2 className="label">Email</h2>
        {options.emailConfigured ? (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-seal"
              checked={gameEmails}
              disabled={preferenceMutation.isPending}
              onChange={(event) => preferenceMutation.mutate(event.target.checked)}
            />
            <span>
              Tell me when a game starts and when every list is in.
              <span className="mt-1 block text-faint">Two emails per game at most. Nothing else, ever.</span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-faint">This instance has no mail server configured, so it sends nothing.</p>
        )}
        {preferenceMutation.isError && <p className="mt-3 text-sm text-seal">{errorMessage(preferenceMutation.error)}</p>}
      </section>

      <section className="border-t border-edge pt-6">
        <h2 className="label">This device</h2>
        <button
          type="button"
          className="button-quiet"
          onClick={async () => {
            await authClient.signOut()
            await queryClient.invalidateQueries()
            void navigate({ to: '/' })
          }}
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
