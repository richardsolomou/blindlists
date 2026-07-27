import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useNavigate } from '@tanstack/react-router'
import { authClient } from '../client/authClient'
import { meQuery } from '../client/queries'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/oswald/500.css'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Sealed Lists — Warhammer 40,000 army lists, revealed together' },
      {
        name: 'description',
        content:
          'Every player seals their Warhammer 40,000 army list. Nothing is revealed until the last list lands, and revealed lists are locked.',
      },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery()),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh">
        <div className="mx-auto w-full max-w-2xl px-5 py-12">
          <div className="flex items-baseline justify-between gap-3">
            <Link to="/" className="font-display text-sm tracking-[0.3em] text-faint uppercase hover:text-brass">
              Sealed Lists
            </Link>
            <Account />
          </div>
          <div className="mt-10">
            <Outlet />
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  )
}

function Account() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  if (!viewer) return null

  return (
    <p className="text-sm text-faint">
      {viewer.name}{' '}
      <button
        type="button"
        className="underline hover:text-brass"
        onClick={async () => {
          await authClient.signOut()
          await queryClient.invalidateQueries()
          void navigate({ to: '/' })
        }}
      >
        sign out
      </button>
    </p>
  )
}
