import type { QueryClient } from '@tanstack/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/oswald/500.css'
import { meQuery } from '../client/queries'
import appCss from '../styles.css?url'

const TITLE = 'Sealed Lists'
const DESCRIPTION =
  'Everyone seals their Warhammer 40,000 army list. Nothing is revealed until the last list is in, and then nothing can change.'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#14120f' },
      { title: `${TITLE} — Warhammer 40,000 army lists, revealed together` },
      { name: 'description', content: DESCRIPTION },
      // Crew links get pasted into group chats, so they need a real card.
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: TITLE },
      { name: 'twitter:card', content: 'summary' },
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
        <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
          <Header />
          <div className="flex-1 py-10 sm:py-12">
            <Outlet />
          </div>
          <Footer />
        </div>
        <Scripts />
      </body>
    </html>
  )
}

function Header() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  return (
    <header className="flex items-center justify-between gap-4 border-b border-edge py-5">
      <Link to="/" className="font-display text-sm tracking-[0.3em] text-parchment uppercase transition-colors hover:text-brass">
        Sealed Lists
      </Link>
      {viewer ? (
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/" className="text-faint transition-colors hover:text-brass">
            Crews
          </Link>
          <Link to="/account" className="text-faint transition-colors hover:text-brass">
            {viewer.name}
          </Link>
        </nav>
      ) : (
        <Link to="/signin" className="text-sm text-faint transition-colors hover:text-brass">
          Sign in
        </Link>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-edge py-6 text-xs text-faint">
      <p>
        Lists stay sealed until the last one is in.{' '}
        <a href="https://github.com/richardsolomou/sealedlists" className="link-quiet">
          Source
        </a>
      </p>
    </footer>
  )
}
