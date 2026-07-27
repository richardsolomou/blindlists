import { useEffect, useState } from 'react'

export function CopyButton({ value, label, description }: { value: string; label: string; description: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      className="button-quiet"
      aria-label={description}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true))
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
