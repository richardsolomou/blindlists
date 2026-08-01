import { describe, expect, it, vi } from 'vitest'
import { mutationRpc } from './rpc'

const request = (origin?: string) =>
  new Request('https://sealed-lists.example.com/action', {
    method: 'POST',
    headers: origin ? { origin, 'sec-fetch-site': 'same-origin' } : undefined,
  })

describe('mutationRpc', () => {
  it('runs same-origin mutations', async () => {
    const work = vi.fn<() => string>(() => 'done')

    await expect(mutationRpc(work, request('https://sealed-lists.example.com'))).resolves.toBe('done')
    expect(work).toHaveBeenCalledOnce()
  })

  it('rejects mutations without an origin before running them', async () => {
    const work = vi.fn<() => void>()

    await expect(mutationRpc(work, request())).rejects.toThrow('cross-origin mutation rejected')
    expect(work).not.toHaveBeenCalled()
  })
})
