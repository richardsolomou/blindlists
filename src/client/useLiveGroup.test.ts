import type { ClientInfo } from 'centrifuge'
import { describe, expect, it } from 'vitest'
import { presentPlayers } from './useLiveGroup'

const client = (user: string, name: string): ClientInfo => ({ client: `${user}-tab`, user, connInfo: { name } })

describe('presentPlayers', () => {
  it('collapses two tabs into one player', () => {
    expect(presentPlayers({ first: client('alex', 'Alex'), second: client('alex', 'Alex') }, new Map(), 100)).toEqual([
      { userId: 'alex', name: 'Alex', typing: false },
    ])
  })

  it('keeps typing live only until its deadline', () => {
    expect(presentPlayers({ first: client('alex', 'Alex') }, new Map([['alex', 101]]), 100)[0]?.typing).toBe(true)
  })

  it('expires typing at its deadline', () => {
    expect(presentPlayers({ first: client('alex', 'Alex') }, new Map([['alex', 100]]), 100)[0]?.typing).toBe(false)
  })

  it('ignores malformed connection information', () => {
    expect(presentPlayers({ first: { client: 'one', user: 'alex' } }, new Map(), 100)).toEqual([])
  })
})
