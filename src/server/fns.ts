import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { app } from './app'
import { configuredProviders } from './auth'
import { requireMutationOrigin } from './mutationOrigin'
import { rpc } from './rpc'
import { createGroupSchema, gameSchema, memberSchema, sealListSchema, startGameSchema, tokenSchema } from './schemas'
import { currentUser, requireUser } from './session'

/** Reads answer null for a link that points at nothing, so the route can render a real 404. */
function orNull<T>(work: () => T) {
  try {
    return work()
  } catch (error) {
    if (error instanceof Response && error.status === 404) return null
    throw error
  }
}

export const me = createServerFn({ method: 'GET' }).handler(() => rpc(() => currentUser()))

/** The sign-in page only offers what the deployment has credentials for. */
export const signInOptions = createServerFn({ method: 'GET' }).handler(() =>
  rpc(() => ({ providers: configuredProviders(), emailConfigured: app().emailConfigured })),
)

export const emailPreference = createServerFn({ method: 'GET' }).handler(() =>
  rpc(async () => {
    const viewer = await currentUser()
    return viewer ? app().service.emailPreference(viewer.id) : null
  }),
)

export const setEmailPreference = createServerFn({ method: 'POST' })
  .validator(z.object({ gameEmails: z.boolean() }))
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.setEmailPreference(viewer.id, data.gameEmails)
    }),
  )

export const myGroups = createServerFn({ method: 'GET' }).handler(() =>
  rpc(async () => {
    const viewer = await currentUser()
    return viewer ? app().service.myGroups(viewer.id) : null
  }),
)

export const createGroup = createServerFn({ method: 'POST' })
  .validator(createGroupSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.createGroup(viewer.id, data.name)
    }),
  )

export const group = createServerFn({ method: 'GET' })
  .validator(tokenSchema)
  .handler(({ data }) =>
    rpc(async () => {
      const viewer = await currentUser()
      // The page shows a sign-in prompt rather than 401ing someone who followed a
      // link — but only for a link that leads somewhere, so a dead one 404s
      // instead of inviting them to a group that does not exist.
      if (!viewer) return app().service.hasGroup(data.token) ? ('signed-out' as const) : null
      return orNull(() => app().service.groupView(data.token, viewer.id))
    }),
  )

export const game = createServerFn({ method: 'GET' })
  .validator(gameSchema)
  .handler(({ data }) =>
    rpc(async () => {
      const viewer = await requireUser()
      return orNull(() => app().service.gameView(data.token, data.gameId, viewer.id))
    }),
  )

export const joinGroup = createServerFn({ method: 'POST' })
  .validator(tokenSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.joinGroup(data.token, viewer.id)
    }),
  )

export const startGame = createServerFn({ method: 'POST' })
  .validator(startGameSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.startGame(data.token, viewer.id, data.userIds)
    }),
  )

export const deleteGame = createServerFn({ method: 'POST' })
  .validator(gameSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.deleteGame(data.token, viewer.id, data.gameId)
    }),
  )

export const sealList = createServerFn({ method: 'POST' })
  .validator(sealListSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.sealList(data.token, viewer.id, data.list)
    }),
  )

export const joinGame = createServerFn({ method: 'POST' })
  .validator(memberSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.joinGame(data.token, viewer.id, data.userId)
    }),
  )

export const dropPlayer = createServerFn({ method: 'POST' })
  .validator(memberSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.dropPlayer(data.token, viewer.id, data.userId)
    }),
  )

export const removeMember = createServerFn({ method: 'POST' })
  .validator(memberSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.removeMember(data.token, viewer.id, data.userId)
    }),
  )
