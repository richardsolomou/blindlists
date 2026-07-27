import { beforeEach, describe, expect, it } from 'vitest'
import { Presence } from './presence'

let now = 1000
let presence: Presence
const alex = { userId: 'alex', name: 'Alex' }
const nick = { userId: 'nick', name: 'Nick' }

beforeEach(() => {
  now = 1000
  presence = new Presence(() => now)
})

describe('who is here', () => {
  it('reports someone once they arrive', () => {
    presence.arrive('tuesday', alex)
    expect(presence.present('tuesday').map((player) => player.name)).toEqual(['Alex'])
  })

  it('forgets them when they leave', () => {
    const leave = presence.arrive('tuesday', alex)
    leave()
    expect(presence.present('tuesday')).toEqual([])
  })

  it('keeps them while a second tab is still open', () => {
    const first = presence.arrive('tuesday', alex)
    presence.arrive('tuesday', alex)
    first()
    expect(presence.present('tuesday').map((player) => player.name)).toEqual(['Alex'])
  })

  it('counts a leave once, however many times it is called', () => {
    const leave = presence.arrive('tuesday', alex)
    presence.arrive('tuesday', alex)
    leave()
    leave()
    expect(presence.present('tuesday').map((player) => player.name)).toEqual(['Alex'])
  })

  it('keeps groups apart', () => {
    presence.arrive('tuesday', alex)
    expect(presence.present('saturday')).toEqual([])
  })

  it('tells the watchers when someone arrives', () => {
    const seen: string[][] = []
    presence.arrive('tuesday', alex, (present) => seen.push(present.map((player) => player.name)))
    presence.arrive('tuesday', nick)
    expect(seen.at(-1)).toEqual(['Alex', 'Nick'])
  })

  it('tells the watchers when someone goes', () => {
    const seen: string[][] = []
    presence.arrive('tuesday', alex, (present) => seen.push(present.map((player) => player.name)))
    const leave = presence.arrive('tuesday', nick)
    leave()
    expect(seen.at(-1)).toEqual(['Alex'])
  })
})

describe('typing', () => {
  it('flags the person typing', () => {
    presence.arrive('tuesday', alex)
    presence.typing('tuesday', 'alex', true)
    expect(presence.present('tuesday')[0].typing).toBe(true)
  })

  it('clears when they stop', () => {
    presence.arrive('tuesday', alex)
    presence.typing('tuesday', 'alex', true)
    presence.typing('tuesday', 'alex', false)
    expect(presence.present('tuesday')[0].typing).toBe(false)
  })

  it('lapses on its own, so a closed laptop does not type forever', () => {
    presence.arrive('tuesday', alex)
    presence.typing('tuesday', 'alex', true)
    now += 10_000
    expect(presence.present('tuesday')[0].typing).toBe(false)
  })

  it('stays up while it keeps being renewed', () => {
    presence.arrive('tuesday', alex)
    presence.typing('tuesday', 'alex', true)
    now += 4_000
    presence.typing('tuesday', 'alex', true)
    now += 4_000
    expect(presence.present('tuesday')[0].typing).toBe(true)
  })

  it('ignores someone with no page open', () => {
    presence.typing('tuesday', 'alex', true)
    expect(presence.present('tuesday')).toEqual([])
  })

  it('survives a second tab closing', () => {
    const first = presence.arrive('tuesday', alex)
    presence.arrive('tuesday', alex)
    presence.typing('tuesday', 'alex', true)
    first()
    expect(presence.present('tuesday')[0].typing).toBe(true)
  })
})
