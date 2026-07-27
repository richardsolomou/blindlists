import crypto from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { RETENTION_MS, normalizeList } from '../core/game'
import { openDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { BlindListsService } from './service'

let service: BlindListsService
let now = 1000

beforeEach(() => {
  now = 1000
  service = new BlindListsService(new Repository(openDatabase(':memory:')), () => now)
})

/** A crew of three with a game running and everyone in it. */
function crewWithGame() {
  const { token } = service.createCrew({ name: 'Tuesday night', memberNames: ['Alex', 'Rich', 'Dan'] })
  const members = service.crewView(token, undefined).members
  const id = (name: string) => members.find((member) => member.name === name)!.id
  service.startGame(
    token,
    id('Alex'),
    members.map((member) => member.id),
  )
  return { token, members, id }
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

describe('createCrew', () => {
  it('seats members in the order they were entered', () => {
    const { token } = service.createCrew({ name: 'Tuesday night', memberNames: ['Alex', 'Rich'] })
    expect(service.crewView(token, undefined).members.map((member) => member.name)).toEqual(['Alex', 'Rich'])
  })

  it('starts with no game', () => {
    const { token } = service.createCrew({ name: 'Tuesday night', memberNames: ['Alex', 'Rich'] })
    expect(service.crewView(token, undefined).currentGame).toBeNull()
  })

  it('rejects an unknown crew link', () => {
    expect(rejection(() => service.crewView('not-a-token', undefined))).toBe(404)
  })
})

describe('claimMember', () => {
  it('confirms a name that belongs to the crew', () => {
    const { token, id } = crewWithGame()
    expect(service.claimMember(token, id('Rich')).name).toBe('Rich')
  })

  it('refuses a member from another crew', () => {
    const { token } = crewWithGame()
    const other = service.createCrew({ name: 'Other crew', memberNames: ['Sam', 'Kim'] })
    const stranger = service.crewView(other.token, undefined).members[0].id
    expect(rejection(() => service.claimMember(token, stranger))).toBe(404)
  })
})

describe('startGame', () => {
  it('numbers games in sequence', () => {
    const { token, id, members } = crewWithGame()
    for (const member of members) service.sealList(token, member.id, `${member.name} list`)
    service.startGame(token, id('Alex'), [id('Alex'), id('Rich')])
    expect(service.crewView(token, id('Alex')).currentGame?.number).toBe(2)
  })

  it('refuses a second game while one is collecting', () => {
    const { token, id } = crewWithGame()
    expect(rejection(() => service.startGame(token, id('Alex'), [id('Alex'), id('Rich')]))).toBe(409)
  })

  it('lets a member sit a game out', () => {
    const { token, id, members } = crewWithGame()
    for (const member of members) service.sealList(token, member.id, `${member.name} list`)
    const view = service.startGame(token, id('Alex'), [id('Alex'), id('Rich')])
    expect(view.currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Rich'])
  })

  it('refuses a visitor who has not tapped a name', () => {
    const { token, id } = crewWithGame()
    expect(rejection(() => service.startGame(token, undefined, [id('Alex'), id('Rich')]))).toBe(403)
  })

  it('refuses fewer than two players', () => {
    const { token, id, members } = crewWithGame()
    for (const member of members) service.sealList(token, member.id, `${member.name} list`)
    expect(rejection(() => service.startGame(token, id('Alex'), [id('Alex')]))).toBe(400)
  })
})

describe('sealList', () => {
  it('fingerprints the normalized list text', () => {
    const { token, id } = crewWithGame()
    const view = service.sealList(token, id('Alex'), '  Captain \r\n Intercessors \n\n')
    const expected = crypto.createHash('sha256').update(normalizeList('  Captain \r\n Intercessors \n\n')).digest('hex')
    expect(view.currentGame?.entries.find((entry) => entry.isViewer)?.listHash).toBe(expected)
  })

  it('replaces an earlier list while the game is still collecting', () => {
    const { token, id } = crewWithGame()
    service.sealList(token, id('Alex'), 'first draft')
    const view = service.sealList(token, id('Alex'), 'second draft')
    expect(view.currentGame?.entries.find((entry) => entry.isViewer)?.list).toBe('second draft')
  })

  it('keeps the game collecting while anyone is outstanding', () => {
    const { token, id } = crewWithGame()
    service.sealList(token, id('Alex'), 'Alex list')
    expect(service.sealList(token, id('Rich'), 'Rich list').currentGame?.status).toBe('collecting')
  })

  it('reveals every list when the last one lands', () => {
    const { token, members, id } = crewWithGame()
    for (const member of members.slice(0, -1)) service.sealList(token, member.id, `${member.name} list`)
    const view = service.sealList(token, id('Dan'), 'Dan list')
    expect(view.currentGame?.entries.map((entry) => entry.list)).toEqual(['Alex list', 'Rich list', 'Dan list'])
  })

  it('keeps the revealed game on the crew page rather than in history', () => {
    const { token, members, id } = crewWithGame()
    for (const member of members) service.sealList(token, member.id, `${member.name} list`)
    expect(service.crewView(token, id('Alex')).pastGames).toEqual([])
  })

  it('rejects a list once the game is revealed', () => {
    const { token, members, id } = crewWithGame()
    for (const member of members) service.sealList(token, member.id, `${member.name} list`)
    expect(rejection(() => service.sealList(token, id('Alex'), 'sneaky rewrite'))).toBe(409)
  })

  it('rejects a list from someone sitting the game out', () => {
    const { token, id, members } = crewWithGame()
    for (const member of members) service.sealList(token, member.id, `${member.name} list`)
    service.startGame(token, id('Alex'), [id('Alex'), id('Rich')])
    expect(rejection(() => service.sealList(token, id('Dan'), 'Dan list'))).toBe(403)
  })

  it('rejects a list that is only whitespace', () => {
    const { token, id } = crewWithGame()
    expect(rejection(() => service.sealList(token, id('Alex'), '  \n \n'))).toBe(400)
  })

  it('rejects a visitor who has not tapped a name', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.sealList(token, undefined, 'a list'))).toBe(403)
  })
})

describe('dropPlayer', () => {
  it('reveals the game when the dropped player was the only one outstanding', () => {
    const { token, id } = crewWithGame()
    service.sealList(token, id('Alex'), 'Alex list')
    service.sealList(token, id('Rich'), 'Rich list')
    expect(service.dropPlayer(token, id('Alex'), id('Dan')).currentGame?.status).toBe('revealed')
  })

  it('refuses to drop a player who has already sealed a list', () => {
    const { token, id } = crewWithGame()
    service.sealList(token, id('Alex'), 'Alex list')
    expect(rejection(() => service.dropPlayer(token, id('Rich'), id('Alex')))).toBe(409)
  })

  it('refuses to drop below two players', () => {
    const { token, id } = crewWithGame()
    service.dropPlayer(token, id('Alex'), id('Dan'))
    expect(rejection(() => service.dropPlayer(token, id('Alex'), id('Rich')))).toBe(409)
  })
})

describe('addMember', () => {
  it('adds a player to the crew for future games', () => {
    const { token, id } = crewWithGame()
    const view = service.addMember(token, id('Alex'), 'Sam')
    expect(view.members.map((member) => member.name)).toEqual(['Alex', 'Rich', 'Dan', 'Sam'])
  })

  it('leaves the running game untouched', () => {
    const { token, id } = crewWithGame()
    const view = service.addMember(token, id('Alex'), 'Sam')
    expect(view.currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Rich', 'Dan'])
  })
})

describe('purgeExpiredGames', () => {
  it('leaves a game alone before it ages out', () => {
    const { token, id } = crewWithGame()
    now += RETENTION_MS - 1
    service.purgeExpiredGames()
    expect(service.crewView(token, id('Alex')).currentGame?.status).toBe('collecting')
  })

  it('deletes a game once it has aged out', () => {
    const { token, id } = crewWithGame()
    now += RETENTION_MS + 1
    service.purgeExpiredGames()
    expect(service.crewView(token, id('Alex')).currentGame).toBeNull()
  })

  it('keeps the crew and its members so the bookmark still works', () => {
    const { token, id } = crewWithGame()
    now += RETENTION_MS + 1
    service.purgeExpiredGames()
    expect(service.crewView(token, id('Alex')).members.map((member) => member.name)).toEqual(['Alex', 'Rich', 'Dan'])
  })

  it('reports how many games it removed', () => {
    crewWithGame()
    crewWithGame()
    now += RETENTION_MS + 1
    expect(service.purgeExpiredGames()).toBe(2)
  })
})
