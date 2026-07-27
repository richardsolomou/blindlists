import { describe, expect, it } from 'vitest'
import { allSealed, duplicateName, gameView, normalizeList } from './game'
import type { EntryRecord, GameRecord } from './game'

const game = (revealedAt: number | null = null): GameRecord => ({ id: 'game1', number: 3, createdAt: 1000, revealedAt })

const entry = (id: string, sealed: boolean): EntryRecord => ({
  memberId: id,
  name: id,
  seat: 1,
  list: sealed ? `${id} list` : null,
})

describe('allSealed', () => {
  it('is false while any player is outstanding', () => {
    expect(allSealed([entry('alex', true), entry('rich', false)])).toBe(false)
  })

  it('is true when every player has sealed', () => {
    expect(allSealed([entry('alex', true), entry('rich', true)])).toBe(true)
  })

  it('is false for a game with nobody in it', () => {
    expect(allSealed([])).toBe(false)
  })
})

describe('gameView while collecting', () => {
  const entries = [entry('alex', true), entry('rich', true)]

  it('hides another player’s list', () => {
    const view = gameView(game(), entries, 'rich')
    expect(view.entries.find((candidate) => candidate.memberId === 'alex')?.list).toBeNull()
  })

  it('still reports that the other player has sealed', () => {
    const view = gameView(game(), entries, 'rich')
    expect(view.entries.find((candidate) => candidate.memberId === 'alex')?.sealed).toBe(true)
  })

  it('shows a player their own list back', () => {
    const view = gameView(game(), entries, 'rich')
    expect(view.entries.find((candidate) => candidate.memberId === 'rich')?.list).toBe('rich list')
  })

  it('hides every list from someone who is not playing', () => {
    const view = gameView(game(), entries, 'dan')
    expect(view.entries.map((candidate) => candidate.list)).toEqual([null, null])
  })

  it('hides every list from a visitor who has not tapped a name', () => {
    const view = gameView(game(), entries, null)
    expect(view.entries.map((candidate) => candidate.list)).toEqual([null, null])
  })

  it('counts how many lists are in', () => {
    const view = gameView(game(), [entry('alex', true), entry('rich', false)], 'alex')
    expect(view.sealed).toBe(1)
  })

  it('reports the viewer as unsealed when they have not submitted', () => {
    const view = gameView(game(), [entry('alex', true), entry('rich', false)], 'rich')
    expect(view.viewerSealed).toBe(false)
  })

  it('reports no viewer entry for someone sitting the game out', () => {
    const view = gameView(game(), entries, 'dan')
    expect(view.viewerSealed).toBeNull()
  })
})

describe('gameView once revealed', () => {
  const entries = [entry('alex', true), entry('rich', true)]

  it('shows every list to a player', () => {
    const view = gameView(game(9), entries, 'rich')
    expect(view.entries.map((candidate) => candidate.list)).toEqual(['alex list', 'rich list'])
  })

  it('shows every list to someone who was not playing', () => {
    const view = gameView(game(9), entries, 'dan')
    expect(view.entries.map((candidate) => candidate.list)).toEqual(['alex list', 'rich list'])
  })

  it('marks which entry belongs to the viewer', () => {
    const view = gameView(game(9), entries, 'rich')
    expect(view.entries.filter((candidate) => candidate.isViewer).map((candidate) => candidate.memberId)).toEqual(['rich'])
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

describe('normalizeList', () => {
  it('rewrites Windows line endings to LF', () => {
    expect(normalizeList('Captain\r\nIntercessors')).toBe('Captain\nIntercessors')
  })

  it('strips trailing whitespace from every line', () => {
    expect(normalizeList('Captain   \n  Intercessors\t')).toBe('Captain\n  Intercessors')
  })

  it('drops leading and trailing blank lines', () => {
    expect(normalizeList('\n\nCaptain\n\n')).toBe('Captain')
  })

  it('keeps blank lines between blocks', () => {
    expect(normalizeList('CHARACTERS\n\nCaptain')).toBe('CHARACTERS\n\nCaptain')
  })
})
