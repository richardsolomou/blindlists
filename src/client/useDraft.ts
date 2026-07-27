import { useCallback, useEffect, useRef, useState } from 'react'
import { saveDraft, setTyping } from '../server/fns'

const SAVE_AFTER_MS = 800
const TYPING_EVERY_MS = 2_500

type Status = 'idle' | 'saving' | 'saved'

/**
 * Holds what someone is typing and keeps the server's copy up to date.
 *
 * Saving is debounced rather than throttled: a list is pasted or edited in
 * bursts, and what matters is the text as it settles, not every keystroke on the
 * way. The pending save is flushed when the page goes away, so closing a tab
 * mid-sentence cannot lose the last few words. Saving also tells the group the
 * typing has stopped, which is why the typing ping only has to fire while it
 * continues.
 */
export function useDraft(token: string, initial: string) {
  const [text, setText] = useState(initial)
  const [status, setStatus] = useState<Status>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastTyping = useRef(0)
  const pending = useRef<string | null>(null)

  const send = useCallback(
    async (draft: string) => {
      pending.current = null
      setStatus('saving')
      try {
        await saveDraft({ data: { token, draft } })
        setStatus('saved')
      } catch {
        // A failed save is not worth interrupting anyone: the text is still on
        // screen, and the next keystroke tries again.
        setStatus('idle')
      }
    },
    [token],
  )

  const flush = useCallback(() => {
    if (pending.current === null) return
    clearTimeout(timer.current)
    void send(pending.current)
  }, [send])

  const change = useCallback(
    (next: string) => {
      setText(next)
      setStatus('idle')
      pending.current = next
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void send(next), SAVE_AFTER_MS)

      const now = Date.now()
      if (now - lastTyping.current > TYPING_EVERY_MS) {
        lastTyping.current = now
        void setTyping({ data: { token } }).catch(() => {})
      }
    },
    [send, token],
  )

  // Leaving the page, or hiding it on a phone, has to take the last edit with it.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      clearTimeout(timer.current)
      flush()
    }
  }, [flush])

  return { text, status, change, reset: setText }
}
