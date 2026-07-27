import { getRequest } from '@tanstack/react-start/server'
import { app } from './app'

export type Viewer = { id: string; name: string; email: string }

/** Route handlers pass their own headers; server functions read them from the ambient request. */
export async function currentUser(headers?: Headers): Promise<Viewer | null> {
  const session = await app().auth.api.getSession({ headers: headers ?? getRequest().headers })
  if (!session) return null
  const { id, name, email } = session.user
  return { id, name, email }
}

/** Everything except signing in and reading the landing page needs an account. */
export async function requireUser() {
  const viewer = await currentUser()
  if (!viewer) throw new Response('sign in first', { status: 401 })
  return viewer
}
