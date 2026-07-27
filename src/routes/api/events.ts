import { createFileRoute } from '@tanstack/react-router'
import { app } from '../../server/app'
import { StreamLimiter } from '../../server/connections'
import { currentUser } from '../../server/session'

const HEARTBEAT_MS = 20_000

const limiter = new StreamLimiter()

const noop = () => {}

/**
 * One stream per open group page. A message says only "this group changed"; the
 * page then refetches through the normal read path, so nothing here decides who
 * may see a list. Members only, so a leaked link buys no stream.
 */
export const Route = createFileRoute('/api/events')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('group')
        if (!token) return new Response('group required', { status: 400 })

        const viewer = await currentUser(request.headers)
        if (!viewer) return new Response('sign in first', { status: 401 })

        let groupId: string
        try {
          groupId = app().service.memberGroupId(token, viewer.id)
        } catch (error) {
          if (error instanceof Response) return error
          throw error
        }

        const release = limiter.enter(viewer.id)
        if (!release) return new Response('too many open streams', { status: 429 })

        const encoder = new TextEncoder()
        let unsubscribe = noop
        let heartbeat: ReturnType<typeof setInterval>
        let closed = false
        const cleanup = () => {
          if (closed) return
          closed = true
          unsubscribe()
          clearInterval(heartbeat)
          release()
        }

        const stream = new ReadableStream({
          start(controller) {
            const push = (chunk: string) => {
              if (closed) return
              try {
                controller.enqueue(encoder.encode(chunk))
              } catch {
                cleanup()
              }
            }
            push('retry: 2000\n\n')
            unsubscribe = app().events.subscribe(groupId, () => push('event: change\ndata: 1\n\n'))
            // Proxies drop a stream that goes quiet, and the browser reconnects
            // on silence too, so say something well inside either timeout.
            heartbeat = setInterval(() => push(': keepalive\n\n'), HEARTBEAT_MS)
          },
          cancel: cleanup,
        })
        request.signal.addEventListener('abort', cleanup, { once: true })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})
