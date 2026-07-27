import { z } from 'zod'
import { CREW_NAME_MAX_LENGTH, LIST_MAX_LENGTH, MEMBERS_MAX, PLAYERS_MIN } from '../core/game'

const token = z.string().min(1).max(64)
const id = z.string().min(1).max(64)

export const createCrewSchema = z.object({ name: z.string().trim().min(1, 'name your crew').max(CREW_NAME_MAX_LENGTH) })

export const tokenSchema = z.object({ token })

export const gameSchema = z.object({ token, gameId: id })

export const startGameSchema = z.object({ token, userIds: z.array(id).min(PLAYERS_MIN).max(MEMBERS_MAX) })

export const sealListSchema = z.object({ token, list: z.string().min(1).max(LIST_MAX_LENGTH) })

export const memberSchema = z.object({ token, userId: id })
