import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { PresentPlayer } from '../server/presence'
import { groupQuery } from './queries'

/**
 * Keeps an open group page current, and reports who else has it open.
 *
 * Two kinds of message arrive on the one stream. `change` carries nothing and
 * only prompts a refetch, so `gameView` stays the only thing deciding what a
 * viewer may see. `presence` carries names and a typing flag — already public
 * among people in the group, and never anything about a list.
 *
 * A stream that dies costs only freshness: `open` refetches, which covers
 * whatever changed while it was down.
 */
export function useLiveGroup(token: string, enabled: boolean) {
  const queryClient = useQueryClient()
  const [present, setPresent] = useState<PresentPlayer[]>([])

  useEffect(() => {
    if (!enabled) return undefined
    const events = new EventSource(`/api/events?group=${encodeURIComponent(token)}`)
    const refresh = () => void queryClient.invalidateQueries({ queryKey: groupQuery(token).queryKey })
    events.addEventListener('open', refresh)
    events.addEventListener('change', refresh)
    events.addEventListener('presence', (message: MessageEvent<string>) => {
      setPresent(JSON.parse(message.data))
    })
    return () => {
      events.close()
      setPresent([])
    }
  }, [token, enabled, queryClient])

  return present
}
