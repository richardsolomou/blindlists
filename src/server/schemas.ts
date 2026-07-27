import { z } from 'zod'
import { GAME_NAME_MAX_LENGTH, NAME_MAX_LENGTH, PLAYERS_MAX, PLAYERS_MIN, duplicateName } from '../core/game'
import { LIST_MAX_LENGTH } from '../core/list'

const token = z.string().min(1).max(64)

export const createGameSchema = z.object({
  name: z.string().trim().min(1, 'name your game').max(GAME_NAME_MAX_LENGTH),
  playerNames: z
    .array(z.string().trim().min(1, 'every player needs a name').max(NAME_MAX_LENGTH))
    .min(PLAYERS_MIN, `a game needs at least ${PLAYERS_MIN} players`)
    .max(PLAYERS_MAX, `a game holds at most ${PLAYERS_MAX} players`)
    .refine((names) => !duplicateName(names), { message: 'player names must be different' }),
})

export const tokenSchema = z.object({ token })

export const sealListSchema = z.object({ token, list: z.string().min(1).max(LIST_MAX_LENGTH) })

export const dropPlayerSchema = z.object({ token, playerId: z.string().min(1).max(32) })
