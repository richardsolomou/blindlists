import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * Leaves a page whose subject was deleted underneath it, saying so on the way.
 *
 * A page can only discover this after it has mounted, on a refetch, and
 * `notFound()` thrown from a render lands in the error boundary rather than on
 * the not-found page — so the exit happens here instead. `leave` is read through
 * a ref so an inline arrow cannot re-fire the toast on a re-render.
 */
export function useGone(gone: boolean, message: string, leave: () => void) {
  const leaveRef = useRef(leave)
  leaveRef.current = leave

  useEffect(() => {
    if (!gone) return
    toast.info(message)
    leaveRef.current()
  }, [gone, message])
}
