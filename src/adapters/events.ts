export type GroupEvent = { type: 'change' } | { type: 'typing'; userId: string; typing: boolean }

export type GroupEvents = {
  publish: (groupId: string, event?: GroupEvent) => void
}

type RealtimeConfig = {
  apiKey: string
  url: string
  fetch?: typeof fetch
}

export const groupChannel = (groupId: string) => `group:${groupId}`

export function createGroupEvents(config: RealtimeConfig): GroupEvents {
  const request = config.fetch ?? fetch
  return {
    publish(groupId, event = { type: 'change' }) {
      void request(`${config.url}/api/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey },
        body: JSON.stringify({ channel: groupChannel(groupId), data: event }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Centrifugo publish failed (${response.status})`)
          const result: unknown = await response.json()
          if (typeof result === 'object' && result !== null && 'error' in result && result.error) {
            throw new Error('Centrifugo rejected a publication')
          }
        })
        .catch((error: unknown) => console.error({ event: 'realtime_publish_failed', error }))
    },
  }
}
