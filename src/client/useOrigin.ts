import { useEffect, useState } from 'react'

/** Invite links need an absolute URL, which only the browser knows. */
export function useOrigin() {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  return origin
}
