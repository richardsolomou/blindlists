import { describe, expect, it } from 'vitest'
import { RETENTION_MS, allSealed, duplicateName, gameView } from './game'
import type { GameRecord, PlayerRecord } from './types'

const hash = (list: string) => `hash(${list})`

const game = (revealedAt: number | null = null): GameRecord => ({ id: 'game1', name: 'Friday night', createdAt: 1000, revealedAt })

const player = (id: string, sealed: boolean): PlayerRecord => ({
  id,
  name: id,
  seat: 1,
  token: `${id}-token`,
  list: sealed ? `${id} list` : null,
})

describe('allSealed', () => {
  it('is false while any player is outstanding', () => {
    expect(allSealed([player('alex', true), player('rich', false)])).toBe(false)
  })

  it('is true when every player has sealed', () => {
    expect(allSealed([player('alex', true), player('rich', true)])).toBe(true)
  })

  it('is false for a game with no players', () => {
    expect(allSealed([])).toBe(false)
  })
})

describe('gameView while collecting', () => {
  const players = [player('alex', true), player('rich', true)]

  it('hides another player’s list from a player', () => {
    const view = gameView(game(), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.find((entry) => entry.id === 'alex')?.list).toBeNull()
  })

  it('hides another player’s fingerprint from a player', () => {
    const view = gameView(game(), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.find((entry) => entry.id === 'alex')?.listHash).toBeNull()
  })

  it('still reports that the other player has sealed', () => {
    const view = gameView(game(), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.find((entry) => entry.id === 'alex')?.sealed).toBe(true)
  })

  it('shows a player their own list back', () => {
    const view = gameView(game(), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.find((entry) => entry.id === 'rich')?.list).toBe('rich list')
  })

  it('hides every list from the host', () => {
    const view = gameView(game(), players, { kind: 'host' }, hash)
    expect(view.players.map((entry) => entry.list)).toEqual([null, null])
  })

  it('counts how many lists are in', () => {
    const view = gameView(game(), [player('alex', true), player('rich', false)], { kind: 'host' }, hash)
    expect(view.sealed).toBe(1)
  })

  it('hands the host every invite link to share', () => {
    const view = gameView(game(), players, { kind: 'host' }, hash)
    expect(view.players.map((entry) => entry.inviteToken)).toEqual(['alex-token', 'rich-token'])
  })

  it('never hands a player another player’s invite link', () => {
    const view = gameView(game(), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.map((entry) => entry.inviteToken)).toEqual([null, null])
  })
})

describe('gameView once revealed', () => {
  const players = [player('alex', true), player('rich', true)]

  it('shows every list to a player', () => {
    const view = gameView(game(9), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.map((entry) => entry.list)).toEqual(['alex list', 'rich list'])
  })

  it('shows every list to the host', () => {
    const view = gameView(game(9), players, { kind: 'host' }, hash)
    expect(view.players.map((entry) => entry.list)).toEqual(['alex list', 'rich list'])
  })

  it('fingerprints each revealed list', () => {
    const view = gameView(game(9), players, { kind: 'host' }, hash)
    expect(view.players.map((entry) => entry.listHash)).toEqual(['hash(alex list)', 'hash(rich list)'])
  })

  it('marks which player the viewer is', () => {
    const view = gameView(game(9), players, { kind: 'player', playerId: 'rich' }, hash)
    expect(view.players.filter((entry) => entry.isViewer).map((entry) => entry.id)).toEqual(['rich'])
  })
})

describe('gameView expiry', () => {
  it('reports when the game will be deleted', () => {
    expect(gameView(game(), [], { kind: 'host' }, hash).expiresAt).toBe(1000 + RETENTION_MS)
  })
})

describe('duplicateName', () => {
  it('reports the first name repeated regardless of case or padding', () => {
    expect(duplicateName(['Alex', 'Rich', ' alex '])).toBe(' alex ')
  })

  it('returns undefined when every name is distinct', () => {
    expect(duplicateName(['Alex', 'Rich'])).toBeUndefined()
  })
})
