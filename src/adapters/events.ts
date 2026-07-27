import { EventEmitter } from 'node:events'

/** Somewhere to say "this group changed" so open pages can refetch. */
export type GroupEvents = {
  publish: (groupId: string) => void
  subscribe: (groupId: string, listener: () => void) => () => void
}

/**
 * In-process fan-out. Events carry a group id and nothing else: a listener is
 * told to refetch, and the refetch goes through `gameView` like any other read,
 * so the stream can never be the thing that leaks a list.
 *
 * One process serves one SQLite file, so there is nothing to distribute.
 */
export function createGroupEvents(): GroupEvents {
  const emitter = new EventEmitter()
  // One listener per open tab, and `StreamLimiter` is what bounds those, so the
  // emitter's own leak warning would only ever fire on a busy evening.
  emitter.setMaxListeners(0)

  return {
    publish: (groupId) => {
      emitter.emit('change', groupId)
    },
    subscribe: (groupId, listener) => {
      const handler = (changed: string) => {
        if (changed === groupId) listener()
      }
      emitter.on('change', handler)
      return () => emitter.off('change', handler)
    },
  }
}
