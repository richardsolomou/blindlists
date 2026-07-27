import { createServerFn } from '@tanstack/react-start'
import { app } from './app'
import { clearMember, readMember, writeMember } from './member'
import { requireMutationOrigin } from './mutationOrigin'
import { rpc } from './rpc'
import {
  addMemberSchema,
  claimMemberSchema,
  createCrewSchema,
  gameSchema,
  memberSchema,
  sealListSchema,
  startGameSchema,
  tokenSchema,
} from './schemas'

/** Reads answer null when the link is wrong or expired, so the route can render a real 404. */
function orNull<T>(work: () => T) {
  try {
    return work()
  } catch (error) {
    if (error instanceof Response && error.status === 404) return null
    throw error
  }
}

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
  .handler(({ data }) => rpc(() => orNull(() => app().service.crewView(data.token, readMember(data.token)))))

export const game = createServerFn({ method: 'GET' })
  .validator(gameSchema)
  .handler(({ data }) => rpc(() => orNull(() => app().service.gameView(data.token, data.gameId, readMember(data.token)))))

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

export const joinGame = createServerFn({ method: 'POST' })
  .validator(memberSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.joinGame(data.token, readMember(data.token), data.memberId)
    }),
  )

export const removeMember = createServerFn({ method: 'POST' })
  .validator(memberSchema)
  .handler(({ data }) =>
    rpc(() => {
      requireMutationOrigin()
      return app().service.removeMember(data.token, readMember(data.token), data.memberId)
    }),
  )

export const dropPlayer = createServerFn({ method: 'POST' })
  .validator(memberSchema)
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
