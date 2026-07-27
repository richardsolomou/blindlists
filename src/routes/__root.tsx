import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
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
          <Link to="/" className="font-display text-sm tracking-[0.3em] text-faint uppercase hover:text-brass">
            Sealed Lists
          </Link>
          <div className="mt-10">
            <Outlet />
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
