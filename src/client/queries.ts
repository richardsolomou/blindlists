import { queryOptions } from '@tanstack/react-query'
import { group, emailPreference, game, me, myGroups, signInOptions } from '../server/fns'

export const meQuery = () => queryOptions({ queryKey: ['me'], queryFn: () => me() })

export const signInOptionsQuery = () => queryOptions({ queryKey: ['sign-in-options'], queryFn: () => signInOptions(), staleTime: Infinity })

export const emailPreferenceQuery = () => queryOptions({ queryKey: ['email-preference'], queryFn: () => emailPreference() })

export const myGroupsQuery = () => queryOptions({ queryKey: ['my-groups'], queryFn: () => myGroups() })

// No polling: `useLiveGroup` refetches this when the server says the group changed.
export const groupQuery = (token: string) => queryOptions({ queryKey: ['group', token], queryFn: () => group({ data: { token } }) })

export const gameQuery = (token: string, gameId: string) =>
  queryOptions({
    queryKey: ['game', token, gameId],
    queryFn: () => game({ data: { token, gameId } }),
  })
