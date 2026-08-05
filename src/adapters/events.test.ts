import { describe, expect, it, vi } from 'vitest'
import { createGroupEvents } from './events'

describe('createGroupEvents', () => {
  it('publishes a list-free change to the group channel', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: {} }))
    const events = createGroupEvents({ apiKey: 'secret', url: 'http://centrifugo:8000', fetch: request })

    events.publish('tuesday')
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())

    expect(request).toHaveBeenCalledWith('http://centrifugo:8000/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'secret' },
      body: JSON.stringify({ channel: 'group:tuesday', data: { type: 'change' } }),
    })
  })

  it('publishes typing without list text', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: {} }))
    const events = createGroupEvents({ apiKey: 'secret', url: 'http://centrifugo:8000', fetch: request })

    events.publish('tuesday', { type: 'typing', userId: 'alex', typing: true })
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())

    const body = request.mock.calls[0]?.[1]?.body
    if (typeof body !== 'string') throw new Error('expected a JSON request body')
    expect(JSON.parse(body)).toEqual({
      channel: 'group:tuesday',
      data: { type: 'typing', userId: 'alex', typing: true },
    })
  })
})
