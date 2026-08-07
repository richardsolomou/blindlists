import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { groupChannel } from '../../adapters/centrifugo'
import { app, requiredEnvironment } from '../../server/app'
import { requireMutationOrigin } from '../../server/mutationOrigin'
import { currentUser } from '../../server/session'

const connectRequest = z.object({ data: z.object({ token: z.string() }) })

const disconnect = () => Response.json({ disconnect: { code: 4501, reason: 'unauthorized' } })

export const Route = createFileRoute('/api/centrifugo/connect')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasProxySecret(request)) return disconnect()
        try {
          requireMutationOrigin(request)
        } catch (error) {
          if (error instanceof Response) return disconnect()
          throw error
        }
        const parsed = connectRequest.safeParse(await request.json().catch(() => null))
        const viewer = await currentUser(request.headers)
        if (!parsed.success || !viewer) return disconnect()

        try {
          const groupId = app().service.memberGroupId(parsed.data.data.token, viewer.id)
          return Response.json({
            result: {
              user: viewer.id,
              info: { name: viewer.name },
              channels: [groupChannel(groupId)],
            },
          })
        } catch (error) {
          if (error instanceof Response) return disconnect()
          throw error
        }
      },
    },
  },
})

function hasProxySecret(request: Request) {
  const expected = requiredEnvironment('CENTRIFUGO_PROXY_SECRET')
  const received = request.headers.get('x-proxy-secret')
  if (!received) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(received)
  return left.length === right.length && timingSafeEqual(left, right)
}
