import { describe, expect, it } from 'vitest'
import { normalizeList, shortFingerprint } from './list'

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

describe('shortFingerprint', () => {
  it('takes the leading 12 hex characters', () => {
    expect(shortFingerprint('0123456789abcdef0123456789abcdef')).toBe('0123456789ab')
  })
})
