import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { RouteError } from './client/components/RouteError'
import { createQueryClient } from './client/queryClient'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createQueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: () => (
      <main className="mx-auto mt-[15vh] max-w-md px-6 text-center">
        <h1 className="text-2xl">Nothing here</h1>
        <p className="mt-2 text-faint">This link is wrong, or the game it pointed at has been deleted.</p>
      </main>
    ),
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
