import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useNavigate } from '@tanstack/react-router'
import { LogOut, User } from 'lucide-react'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/oswald/500.css'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { authClient } from '../client/authClient'
import { meQuery } from '../client/queries'
import appCss from '../styles.css?url'

const TITLE = 'Sealed Lists'
const DESCRIPTION = 'Everyone pastes their Warhammer 40,000 list. They stay hidden until the last one is in, then they all open at once.'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#14120f' },
      { title: `${TITLE} — swap Warhammer 40,000 lists without seeing them first` },
      { name: 'description', content: DESCRIPTION },
      // Group links get pasted into chats, so they need a real card.
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
          <div className="flex-1 py-10 sm:py-14">
            <Outlet />
          </div>
          <footer className="border-t border-edge py-6 text-xs text-faint">
            <a
              href="https://github.com/richardsolomou/sealedlists"
              className="underline decoration-edge underline-offset-4 hover:text-brass"
            >
              Source
            </a>
          </footer>
        </div>
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}

function Header() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-edge py-4">
      <Link to="/" className="font-display text-sm tracking-[0.3em] text-parchment uppercase transition-colors hover:text-brass">
        Sealed Lists
      </Link>
      {viewer ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="gap-2 normal-case">
                <User className="text-faint" />
                {viewer.name}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link to="/">Your groups</Link>} />
            <DropdownMenuItem render={<Link to="/account">Account</Link>} />
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut()
                await queryClient.invalidateQueries()
                void navigate({ to: '/' })
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link to="/signin" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          Sign in
        </Link>
      )}
    </header>
  )
}
