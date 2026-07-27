import { z } from 'zod'
import { CREW_NAME_MAX_LENGTH, LIST_MAX_LENGTH, MEMBERS_MAX, MEMBERS_MIN, NAME_MAX_LENGTH, duplicateName } from '../core/game'

const token = z.string().min(1).max(64)
const id = z.string().min(1).max(32)
const memberName = z.string().trim().min(1, 'every player needs a name').max(NAME_MAX_LENGTH)

export const createCrewSchema = z.object({
  name: z.string().trim().min(1, 'name your crew').max(CREW_NAME_MAX_LENGTH),
  memberNames: z
    .array(memberName)
    .min(MEMBERS_MIN, `a crew needs at least ${MEMBERS_MIN} players`)
    .max(MEMBERS_MAX, `a crew holds at most ${MEMBERS_MAX} players`)
    .refine((names) => !duplicateName(names), { message: 'player names must be different' }),
})

export const tokenSchema = z.object({ token })

export const claimMemberSchema = z.object({ token, memberId: id })

export const gameSchema = z.object({ token, gameId: id })

export const startGameSchema = z.object({ token, memberIds: z.array(id).min(2).max(MEMBERS_MAX) })

export const sealListSchema = z.object({ token, list: z.string().min(1).max(LIST_MAX_LENGTH) })

export const dropPlayerSchema = z.object({ token, memberId: id })

export const addMemberSchema = z.object({ token, name: memberName })
