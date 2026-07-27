import crypto from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { RETENTION_MS } from '../core/game'
import { normalizeList } from '../core/list'
import { openDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { BlindListsService } from './service'

let service: BlindListsService
let now = 1000

beforeEach(() => {
  now = 1000
  service = new BlindListsService(new Repository(openDatabase(':memory:')), () => now)
})

function threePlayerGame() {
  const { hostToken } = service.createGame({ name: 'Friday night', playerNames: ['Alex', 'Rich', 'Dan'] })
  const invites = service.hostView(hostToken).players.map((player) => ({ id: player.id, name: player.name, token: player.inviteToken! }))
  return { hostToken, invites }
}

/** Server-side failures are thrown `Response` objects; assert on the status they carry. */
function rejection(work: () => unknown) {
  try {
    work()
    return 'no error'
  } catch (error) {
    return error instanceof Response ? error.status : error
  }
}

describe('createGame', () => {
  it('seats players in the order they were entered', () => {
    const { hostToken } = threePlayerGame()
    expect(service.hostView(hostToken).players.map((player) => player.name)).toEqual(['Alex', 'Rich', 'Dan'])
  })

  it('issues a distinct invite token per player', () => {
    const { invites } = threePlayerGame()
    expect(new Set(invites.map((invite) => invite.token)).size).toBe(3)
  })

  it('starts out collecting', () => {
    const { hostToken } = threePlayerGame()
    expect(service.hostView(hostToken).status).toBe('collecting')
  })
})

describe('sealList', () => {
  it('fingerprints the normalized list text', () => {
    const { invites } = threePlayerGame()
    const view = service.sealList(invites[0].token, '  Captain \r\n Intercessors \n\n')
    const expected = crypto.createHash('sha256').update(normalizeList('  Captain \r\n Intercessors \n\n')).digest('hex')
    expect(view.players.find((player) => player.isViewer)?.listHash).toBe(expected)
  })

  it('replaces an earlier list while the game is still collecting', () => {
    const { invites } = threePlayerGame()
    service.sealList(invites[0].token, 'first draft')
    const view = service.sealList(invites[0].token, 'second draft')
    expect(view.players.find((player) => player.isViewer)?.list).toBe('second draft')
  })

  it('keeps the game collecting while anyone is outstanding', () => {
    const { invites } = threePlayerGame()
    service.sealList(invites[0].token, 'a list')
    expect(service.sealList(invites[1].token, 'a list').status).toBe('collecting')
  })

  it('reveals every list when the last one lands', () => {
    const { invites } = threePlayerGame()
    for (const invite of invites.slice(0, -1)) service.sealList(invite.token, `${invite.name} list`)
    const view = service.sealList(invites.at(-1)!.token, 'Dan list')
    expect(view.players.map((player) => player.list)).toEqual(['Alex list', 'Rich list', 'Dan list'])
  })

  it('rejects a list once the game is revealed', () => {
    const { invites } = threePlayerGame()
    for (const invite of invites) service.sealList(invite.token, `${invite.name} list`)
    expect(rejection(() => service.sealList(invites[0].token, 'sneaky rewrite'))).toBe(409)
  })

  it('rejects a list that is only whitespace', () => {
    const { invites } = threePlayerGame()
    expect(rejection(() => service.sealList(invites[0].token, '  \n \n'))).toBe(400)
  })

  it('rejects an unknown invite token', () => {
    threePlayerGame()
    expect(rejection(() => service.sealList('not-a-token', 'a list'))).toBe(404)
  })
})

describe('playerView', () => {
  it('hides a sealed list from the other players', () => {
    const { invites } = threePlayerGame()
    service.sealList(invites[0].token, 'Alex list')
    const view = service.playerView(invites[1].token)
    expect(view.players.find((player) => player.name === 'Alex')?.list).toBeNull()
  })

  it('reports how many lists are in', () => {
    const { invites } = threePlayerGame()
    service.sealList(invites[0].token, 'Alex list')
    expect(service.playerView(invites[1].token).sealed).toBe(1)
  })
})

describe('dropPlayer', () => {
  it('reveals the game when the dropped player was the only one outstanding', () => {
    const { hostToken, invites } = threePlayerGame()
    service.sealList(invites[0].token, 'Alex list')
    service.sealList(invites[1].token, 'Rich list')
    expect(service.dropPlayer(hostToken, invites[2].id).status).toBe('revealed')
  })

  it('refuses to drop a player who has already sealed a list', () => {
    const { hostToken, invites } = threePlayerGame()
    service.sealList(invites[0].token, 'Alex list')
    expect(rejection(() => service.dropPlayer(hostToken, invites[0].id))).toBe(409)
  })

  it('refuses to drop below two players', () => {
    const { hostToken, invites } = threePlayerGame()
    service.dropPlayer(hostToken, invites[2].id)
    expect(rejection(() => service.dropPlayer(hostToken, invites[1].id))).toBe(409)
  })

  it('refuses an unknown host token', () => {
    const { invites } = threePlayerGame()
    expect(rejection(() => service.dropPlayer('not-a-token', invites[0].id))).toBe(404)
  })
})

describe('purgeExpiredGames', () => {
  it('leaves a game alone before it ages out', () => {
    const { hostToken } = threePlayerGame()
    now += RETENTION_MS - 1
    service.purgeExpiredGames()
    expect(service.hostView(hostToken).status).toBe('collecting')
  })

  it('deletes a game once it has aged out', () => {
    const { hostToken } = threePlayerGame()
    now += RETENTION_MS + 1
    service.purgeExpiredGames()
    expect(rejection(() => service.hostView(hostToken))).toBe(404)
  })

  it('takes the players with it', () => {
    const { invites } = threePlayerGame()
    now += RETENTION_MS + 1
    service.purgeExpiredGames()
    expect(rejection(() => service.playerView(invites[0].token))).toBe(404)
  })

  it('reports how many games it removed', () => {
    threePlayerGame()
    threePlayerGame()
    now += RETENTION_MS + 1
    expect(service.purgeExpiredGames()).toBe(2)
  })
})
