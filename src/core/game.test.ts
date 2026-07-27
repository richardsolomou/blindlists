import { describe, expect, it } from 'vitest'
import { allSealed, gameView, normalizeList } from './game'
import type { EntryRecord, GameRecord } from './game'

const game = (revealedAt: number | null = null): GameRecord => ({ id: 'game1', number: 3, createdAt: 1000, revealedAt })

const entry = (id: string, sealed: boolean, draft: string | null = null): EntryRecord => ({
  userId: id,
  name: id,
  list: sealed ? `${id} list` : null,
  draft,
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
    expect(gameView(game(), entries, 'rich').entries.find((e) => e.userId === 'alex')?.list).toBeNull()
  })

  it('still reports that the other player has sealed', () => {
    expect(gameView(game(), entries, 'rich').entries.find((e) => e.userId === 'alex')?.sealed).toBe(true)
  })

  it('shows a player their own list back', () => {
    expect(gameView(game(), entries, 'rich').entries.find((e) => e.userId === 'rich')?.list).toBe('rich list')
  })

  it('hides every list from someone who is not playing', () => {
    expect(gameView(game(), entries, 'dan').entries.map((e) => e.list)).toEqual([null, null])
  })

  it('hides every list from a signed-out visitor', () => {
    expect(gameView(game(), entries, null).entries.map((e) => e.list)).toEqual([null, null])
  })

  it('counts how many lists are in', () => {
    expect(gameView(game(), [entry('alex', true), entry('rich', false)], 'alex').sealed).toBe(1)
  })

  it('reports the viewer as unsealed when they have not submitted', () => {
    expect(gameView(game(), [entry('alex', true), entry('rich', false)], 'rich').viewerSealed).toBe(false)
  })

  it('reports no viewer entry for someone sitting the game out', () => {
    expect(gameView(game(), entries, 'dan').viewerSealed).toBeNull()
  })
})

describe('gameView once revealed', () => {
  const entries = [entry('alex', true), entry('rich', true)]

  it('shows every list to a player', () => {
    expect(gameView(game(9), entries, 'rich').entries.map((e) => e.list)).toEqual(['alex list', 'rich list'])
  })

  it('shows every list to someone who was not playing', () => {
    expect(gameView(game(9), entries, 'dan').entries.map((e) => e.list)).toEqual(['alex list', 'rich list'])
  })

  it('marks which entry belongs to the viewer', () => {
    expect(
      gameView(game(9), entries, 'rich')
        .entries.filter((e) => e.isViewer)
        .map((e) => e.userId),
    ).toEqual(['rich'])
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

describe('a draft in gameView', () => {
  it('reaches its author', () => {
    const entries = [entry('alex', false, 'half a list'), entry('rich', true)]
    expect(gameView(game(), entries, 'alex').viewerDraft).toBe('half a list')
  })

  it('reaches nobody else', () => {
    const entries = [entry('alex', false, 'half a list'), entry('rich', true)]
    expect(gameView(game(), entries, 'rich').viewerDraft).toBeNull()
  })

  it('is not in the entries, so it cannot leak through one', () => {
    const entries = [entry('alex', false, 'half a list')]
    expect(JSON.stringify(gameView(game(), entries, 'rich').entries)).not.toContain('half a list')
  })

  it('is withheld from a signed-out reader like everything else', () => {
    const entries = [entry('alex', false, 'half a list')]
    expect(gameView(game(), entries, null).viewerDraft).toBeNull()
  })

  it('does not make its author count as sealed', () => {
    const entries = [entry('alex', false, 'half a list'), entry('rich', true)]
    expect(gameView(game(), entries, 'alex').viewerSealed).toBe(false)
  })

  it('leaves a revealed game reading as revealed', () => {
    const entries = [entry('alex', true), entry('rich', true)]
    expect(gameView(game(2000), entries, 'alex').viewerDraft).toBeNull()
  })
})

describe('allSealed with a draft outstanding', () => {
  it('is false while someone is still writing', () => {
    expect(allSealed([entry('alex', true), entry('rich', false, 'nearly there')])).toBe(false)
  })
})
