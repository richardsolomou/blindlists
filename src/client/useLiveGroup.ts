import { useQueryClient } from '@tanstack/react-query'
import { Centrifuge, type ClientInfo } from 'centrifuge'
import { useEffect, useState } from 'react'
import type { RealtimeEvent } from '../adapters/centrifugo'
import { groupQuery } from './queries'

const TYPING_TTL_MS = 6_000

export type PresentPlayer = { userId: string; name: string; typing: boolean }

export function useLiveGroup(token: string, enabled: boolean) {
  const queryClient = useQueryClient()
  const [present, setPresent] = useState<PresentPlayer[]>([])

  useEffect(() => {
    if (!enabled) return undefined

    const channel = { current: '' }
    const typing = new Map<string, number>()
    let sweep: ReturnType<typeof setTimeout> | undefined
    let closed = false
    let presenceRequest = 0
    const realtime = new Centrifuge(websocketUrl(), { data: { token } })
    const refresh = () => void queryClient.invalidateQueries({ queryKey: groupQuery(token).queryKey })
    const syncPresence = async () => {
      if (!channel.current) return
      const request = ++presenceRequest
      try {
        const { clients } = await realtime.presence(channel.current)
        const players = presentPlayers(clients, typing, Date.now())
        if (!closed && request === presenceRequest) setPresent(players)
      } catch (error) {
        console.error({ event: 'realtime_presence_failed', error })
      }
    }
    const scheduleTypingSweep = () => {
      clearTimeout(sweep)
      const next = Math.min(...typing.values())
      if (!Number.isFinite(next)) return
      sweep = setTimeout(
        () => {
          const now = Date.now()
          for (const [userId, until] of typing) if (until <= now) typing.delete(userId)
          void syncPresence()
          scheduleTypingSweep()
        },
        Math.max(0, next - Date.now()) + 50,
      )
    }

    realtime.on('connected', refresh)
    realtime.on('subscribed', ({ channel: subscribed }) => {
      channel.current = subscribed
      refresh()
      void syncPresence()
    })
    realtime.on('join', () => void syncPresence())
    realtime.on('leave', () => void syncPresence())
    realtime.on('publication', ({ data }) => {
      const event = groupEvent(data)
      if (!event) return
      if (event.type === 'change') {
        refresh()
        void syncPresence()
        return
      }
      if (event.type !== 'typing') return
      if (event.typing) typing.set(event.userId, Date.now() + TYPING_TTL_MS)
      else typing.delete(event.userId)
      scheduleTypingSweep()
      void syncPresence()
    })
    realtime.connect()

    return () => {
      closed = true
      clearTimeout(sweep)
      realtime.disconnect()
      setPresent([])
    }
  }, [token, enabled, queryClient])

  return present
}

export function presentPlayers(clients: Record<string, ClientInfo>, typing: Map<string, number>, now: number): PresentPlayer[] {
  const players = new Map<string, PresentPlayer>()
  for (const client of Object.values(clients)) {
    const name = connectionName(client)
    if (client.user && name) players.set(client.user, { userId: client.user, name, typing: (typing.get(client.user) ?? 0) > now })
  }
  return [...players.values()].toSorted((left, right) => left.name.localeCompare(right.name) || left.userId.localeCompare(right.userId))
}

function connectionName(client: ClientInfo) {
  if (typeof client.connInfo !== 'object' || client.connInfo === null || !('name' in client.connInfo)) return undefined
  return typeof client.connInfo.name === 'string' ? client.connInfo.name : undefined
}

function websocketUrl() {
  const url = new URL('/connection/websocket', window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function groupEvent(value: unknown): RealtimeEvent | undefined {
  if (typeof value !== 'object' || value === null || !('type' in value)) return undefined
  if (value.type === 'change') return { type: 'change' }
  if (
    value.type === 'typing' &&
    'userId' in value &&
    typeof value.userId === 'string' &&
    'typing' in value &&
    typeof value.typing === 'boolean'
  ) {
    return { type: 'typing', userId: value.userId, typing: value.typing }
  }
  return undefined
}
