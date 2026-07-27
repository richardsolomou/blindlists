import { queryOptions } from '@tanstack/react-query'
import type { CrewView } from '../core/game'
import { crew, game, me, myCrews } from '../server/fns'

// While a game is collecting the page polls, so everyone sees the reveal land
// without refreshing; a revealed game never changes again.
const collecting = (query: { state: { data?: CrewView | 'signed-out' | null } }) =>
  typeof query.state.data === 'object' && query.state.data?.currentGame?.status === 'collecting' ? 5000 : false

export const meQuery = () => queryOptions({ queryKey: ['me'], queryFn: () => me() })

export const myCrewsQuery = () => queryOptions({ queryKey: ['my-crews'], queryFn: () => myCrews() })

export const crewQuery = (token: string) =>
  queryOptions({
    queryKey: ['crew', token],
    queryFn: () => crew({ data: { token } }),
    refetchInterval: collecting,
  })

export const gameQuery = (token: string, gameId: string) =>
  queryOptions({
    queryKey: ['game', token, gameId],
    queryFn: () => game({ data: { token, gameId } }),
  })
