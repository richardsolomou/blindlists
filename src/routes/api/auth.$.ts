import { createFileRoute } from '@tanstack/react-router'
import { app } from '../../server/app'

/** better-auth owns every /api/auth/* route: sign-up, sign-in, sign-out, session. */
const handle = ({ request }: { request: Request }) => app().auth.handler(request)

export const Route = createFileRoute('/api/auth/$')({
  server: { handlers: { GET: handle, POST: handle } },
})
