import { createServerFn } from '@tanstack/react-start'
import { app } from './app'
import { clearMember, readMember, writeMember } from './member'
import { requireMutationOrigin } from './mutationOrigin'
import { rpc } from './rpc'
import {
  addMemberSchema,
  claimMemberSchema,
  createCrewSchema,
  dropPlayerSchema,
  gameSchema,
  sealListSchema,
  startGameSchema,
  tokenSchema,
} from './schemas'

export const createCrew = createServerFn({ method: 'POST' })
  .validator(createCrewSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.createCrew(data)
    }),
  )

export const crew = createServerFn({ method: 'GET' })
  .validator(tokenSchema)
  .handler(({ data }) => rpc(() => app().service.crewView(data.token, readMember(data.token))))

export const game = createServerFn({ method: 'GET' })
  .validator(gameSchema)
  .handler(({ data }) => rpc(() => app().service.gameView(data.token, data.gameId, readMember(data.token))))

export const claimMember = createServerFn({ method: 'POST' })
  .validator(claimMemberSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      const member = app().service.claimMember(data.token, data.memberId)
      writeMember(data.token, member.id)
      return app().service.crewView(data.token, member.id)
    }),
  )

export const forgetMember = createServerFn({ method: 'POST' })
  .validator(tokenSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      clearMember(data.token)
      return app().service.crewView(data.token, undefined)
    }),
  )

export const startGame = createServerFn({ method: 'POST' })
  .validator(startGameSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.startGame(data.token, readMember(data.token), data.memberIds)
    }),
  )

export const sealList = createServerFn({ method: 'POST' })
  .validator(sealListSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.sealList(data.token, readMember(data.token), data.list)
    }),
  )

export const dropPlayer = createServerFn({ method: 'POST' })
  .validator(dropPlayerSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.dropPlayer(data.token, readMember(data.token), data.memberId)
    }),
  )

export const addMember = createServerFn({ method: 'POST' })
  .validator(addMemberSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.addMember(data.token, readMember(data.token), data.name)
    }),
  )
