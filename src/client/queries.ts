import { queryOptions } from '@tanstack/react-query'
import type { GameView } from '../core/types'
import { hostGame, playerGame } from '../server/fns'

// While lists are still coming in the page polls, so everyone sees the reveal
// land without refreshing; a revealed game never changes again.
const collecting = (query: { state: { data?: GameView } }) => (query.state.data?.status === 'collecting' ? 5000 : false)

export const hostGameQuery = (token: string) =>
  queryOptions({
    queryKey: ['host-game', token],
    queryFn: () => hostGame({ data: { token } }),
    refetchInterval: collecting,
  })

export const playerGameQuery = (token: string) =>
  queryOptions({
    queryKey: ['player-game', token],
    queryFn: () => playerGame({ data: { token } }),
    refetchInterval: collecting,
  })
