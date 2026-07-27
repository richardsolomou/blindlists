import { queryOptions } from '@tanstack/react-query'
import type { GroupView } from '../core/game'
import { group, emailPreference, game, me, myGroups, signInOptions } from '../server/fns'

// While a game is collecting the page polls, so everyone sees the reveal land
// without refreshing; a revealed game never changes again.
const collecting = (query: { state: { data?: GroupView | 'signed-out' | null } }) =>
  typeof query.state.data === 'object' && query.state.data?.currentGame?.status === 'collecting' ? 5000 : false

export const meQuery = () => queryOptions({ queryKey: ['me'], queryFn: () => me() })

export const signInOptionsQuery = () => queryOptions({ queryKey: ['sign-in-options'], queryFn: () => signInOptions(), staleTime: Infinity })

export const emailPreferenceQuery = () => queryOptions({ queryKey: ['email-preference'], queryFn: () => emailPreference() })

export const myGroupsQuery = () => queryOptions({ queryKey: ['my-groups'], queryFn: () => myGroups() })

export const groupQuery = (token: string) =>
  queryOptions({
    queryKey: ['group', token],
    queryFn: () => group({ data: { token } }),
    refetchInterval: collecting,
  })

export const gameQuery = (token: string, gameId: string) =>
  queryOptions({
    queryKey: ['game', token, gameId],
    queryFn: () => game({ data: { token, gameId } }),
  })
