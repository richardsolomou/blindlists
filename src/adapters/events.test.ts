import { describe, expect, it } from 'vitest'
import { createGroupEvents } from './events'

describe('createGroupEvents', () => {
  it('tells a subscriber its own group changed', () => {
    const events = createGroupEvents()
    let heard = 0
    events.subscribe('tuesday', () => heard++)
    events.publish('tuesday')
    expect(heard).toBe(1)
  })

  it('stays quiet about another group', () => {
    const events = createGroupEvents()
    let heard = 0
    events.subscribe('tuesday', () => heard++)
    events.publish('saturday')
    expect(heard).toBe(0)
  })

  it('stops after unsubscribing', () => {
    const events = createGroupEvents()
    let heard = 0
    const unsubscribe = events.subscribe('tuesday', () => heard++)
    unsubscribe()
    events.publish('tuesday')
    expect(heard).toBe(0)
  })
})
