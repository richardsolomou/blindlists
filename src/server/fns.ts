import { createServerFn } from '@tanstack/react-start'
import { app } from './app'
import { requireMutationOrigin } from './mutationOrigin'
import { rpc } from './rpc'
import { createGameSchema, dropPlayerSchema, sealListSchema, tokenSchema } from './schemas'

export const createGame = createServerFn({ method: 'POST' })
  .validator(createGameSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.createGame(data)
    }),
  )

export const hostGame = createServerFn({ method: 'GET' })
  .validator(tokenSchema)
  .handler(({ data }) => rpc(() => app().service.hostView(data.token)))

export const playerGame = createServerFn({ method: 'GET' })
  .validator(tokenSchema)
  .handler(({ data }) => rpc(() => app().service.playerView(data.token)))

export const sealList = createServerFn({ method: 'POST' })
  .validator(sealListSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.sealList(data.token, data.list)
    }),
  )

export const dropPlayer = createServerFn({ method: 'POST' })
  .validator(dropPlayerSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.dropPlayer(data.token, data.playerId)
    }),
  )
