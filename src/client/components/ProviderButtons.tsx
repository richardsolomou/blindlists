import { authClient } from '../authClient'
import type { SocialProvider } from '../../server/auth'

const LABELS: Record<SocialProvider, string> = { google: 'Continue with Google', discord: 'Continue with Discord' }

/** Marks drawn inline: two logo files is not worth a build step. */
const MARKS: Record<SocialProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.7-.1-1.3-.2-1.9H12Z"
      />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.3 5.4A16.6 16.6 0 0 0 15.2 4l-.3.7c1.4.3 2.5.8 3.6 1.5-1.9-.9-3.8-1.4-6.5-1.4S7.4 5.3 5.5 6.2c1-.7 2.3-1.3 3.6-1.5L8.8 4a16.4 16.4 0 0 0-4.1 1.4C2.6 9 2 12.6 2.2 16.2A12 12 0 0 0 7.9 19l.8-1.2c-1-.3-1.9-.8-2.7-1.4l.6-.4a11.7 11.7 0 0 0 10.8 0l.6.4c-.8.6-1.7 1-2.7 1.4l.8 1.2a12 12 0 0 0 5.7-2.8c.3-4.2-.6-7.8-2.5-10.8ZM8.9 14.3c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Zm6.2 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Z"
      />
    </svg>
  ),
}

export function ProviderButtons({ providers, next }: { providers: SocialProvider[]; next?: string }) {
  if (providers.length === 0) return null
  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className="button-provider"
          onClick={() => void authClient.signIn.social({ provider, callbackURL: next ?? '/' })}
        >
          {MARKS[provider]}
          {LABELS[provider]}
        </button>
      ))}
    </div>
  )
}
