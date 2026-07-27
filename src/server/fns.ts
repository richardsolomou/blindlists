import { createServerFn } from '@tanstack/react-start'
import { app } from './app'
import { requireMutationOrigin } from './mutationOrigin'
import { rpc } from './rpc'
import { createCrewSchema, gameSchema, memberSchema, sealListSchema, startGameSchema, tokenSchema } from './schemas'
import { currentUser, requireUser } from './session'

/** Reads answer null when the link is wrong or expired, so the route can render a real 404. */
function orNull<T>(work: () => T) {
  try {
    return work()
  } catch (error) {
    if (error instanceof Response && error.status === 404) return null
    throw error
  }
}

export const me = createServerFn({ method: 'GET' }).handler(() => rpc(() => currentUser()))

export const myCrews = createServerFn({ method: 'GET' }).handler(() =>
  rpc(async () => {
    const viewer = await currentUser()
    return viewer ? app().service.myCrews(viewer.id) : null
  }),
)

export const createCrew = createServerFn({ method: 'POST' })
  .validator(createCrewSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.createCrew(viewer.id, data.name)
    }),
  )

export const crew = createServerFn({ method: 'GET' })
  .validator(tokenSchema)
  .handler(({ data }) =>
    rpc(async () => {
      const viewer = await currentUser()
      // The page shows a sign-in prompt rather than 401ing someone who followed a link.
      if (!viewer) return 'signed-out' as const
      return orNull(() => app().service.crewView(data.token, viewer.id))
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

export const joinCrew = createServerFn({ method: 'POST' })
  .validator(tokenSchema)
  .handler(({ data }) =>
    rpc(async () => {
      requireMutationOrigin()
      const viewer = await requireUser()
      return app().service.joinCrew(data.token, viewer.id)
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
