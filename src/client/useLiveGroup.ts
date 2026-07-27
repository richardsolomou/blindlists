import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { groupQuery } from './queries'

/**
 * Keeps an open group page current: the server nudges, the page refetches. The
 * refetch is what carries data, so a stream that dies only costs freshness —
 * `onopen` refetches too, which covers whatever changed while it was down.
 */
export function useLiveGroup(token: string, enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return undefined
    const events = new EventSource(`/api/events?group=${encodeURIComponent(token)}`)
    const refresh = () => void queryClient.invalidateQueries({ queryKey: groupQuery(token).queryKey })
    events.addEventListener('open', refresh)
    events.addEventListener('change', refresh)
    return () => events.close()
  }, [token, enabled, queryClient])
}
