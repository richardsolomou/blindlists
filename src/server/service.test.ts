import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeList } from '../core/game'
import { openDatabase, type SealedListsDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { user } from '../db/schema'
import { SealedListsService } from './service'

let database: SealedListsDatabase
let service: SealedListsService
let now = 1000

/** Accounts are better-auth's to create; tests only need the rows to exist. */
function makeUser(id: string, name: string) {
  database
    .insert(user)
    .values({ id, name, email: `${id}@example.test`, emailVerified: false, createdAt: new Date(now), updatedAt: new Date(now) })
    .run()
}

beforeEach(() => {
  now = 1000
  database = openDatabase(':memory:')
  service = new SealedListsService(new Repository(database), () => now)
  for (const name of ['Alex', 'Rich', 'Dan', 'Sam']) makeUser(name.toLowerCase(), name)
})

/** A crew of three with a game running and everyone in it. */
function crewWithGame() {
  const { token } = service.createCrew('alex', 'Tuesday night')
  service.joinCrew(token, 'rich')
  service.joinCrew(token, 'dan')
  service.startGame(token, 'alex', ['alex', 'rich', 'dan'])
  return { token }
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
  it('puts the creator in the crew', () => {
    const { token } = service.createCrew('alex', 'Tuesday night')
    expect(service.crewView(token, 'alex').members.map((member) => member.name)).toEqual(['Alex'])
  })

  it('starts with no game', () => {
    const { token } = service.createCrew('alex', 'Tuesday night')
    expect(service.crewView(token, 'alex').currentGame).toBeNull()
  })

  it('rejects an unknown crew link', () => {
    expect(rejection(() => service.crewView('not-a-token', 'alex'))).toBe(404)
  })
})

describe('myCrews', () => {
  it('lists the crews you belong to', () => {
    service.createCrew('alex', 'Tuesday night')
    now += 10
    service.createCrew('alex', 'Saturday campaign')
    expect(service.myCrews('alex').map((crew) => crew.name)).toEqual(['Saturday campaign', 'Tuesday night'])
  })

  it('leaves out crews you are not in', () => {
    service.createCrew('alex', 'Tuesday night')
    expect(service.myCrews('rich')).toEqual([])
  })

  it('flags a crew where you still owe a list', () => {
    crewWithGame()
    expect(service.myCrews('rich')[0].needsList).toBe(true)
  })

  it('stops flagging once you have sealed', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'rich', 'Rich list')
    expect(service.myCrews('rich')[0].needsList).toBe(false)
  })
})

describe('a link holder who has not joined', () => {
  it('sees the crew name and who is in it', () => {
    const { token } = crewWithGame()
    expect(service.crewView(token, 'sam').members.map((member) => member.name)).toEqual(['Alex', 'Dan', 'Rich'])
  })

  it('is told they are not a member', () => {
    const { token } = crewWithGame()
    expect(service.crewView(token, 'sam').isMember).toBe(false)
  })

  it('is shown no game at all', () => {
    const { token } = crewWithGame()
    expect(service.crewView(token, 'sam').currentGame).toBeNull()
  })

  it('cannot open a game directly', () => {
    const { token } = crewWithGame()
    const gameId = service.crewView(token, 'alex').currentGame!.id
    expect(rejection(() => service.gameView(token, gameId, 'sam'))).toBe(403)
  })

  it('cannot seal a list', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.sealList(token, 'sam', 'Sam list'))).toBe(403)
  })

  it('becomes a member by joining', () => {
    const { token } = crewWithGame()
    expect(service.joinCrew(token, 'sam').isMember).toBe(true)
  })

  it('is not added to a game that is already running', () => {
    const { token } = crewWithGame()
    expect(service.joinCrew(token, 'sam').currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Dan', 'Rich'])
  })
})

describe('startGame', () => {
  it('numbers games in sequence', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    expect(service.crewView(token, 'alex').currentGame?.number).toBe(2)
  })

  it('refuses a second game while one is collecting', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.startGame(token, 'alex', ['alex', 'rich']))).toBe(409)
  })

  it('lets a member sit a game out', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    const view = service.startGame(token, 'alex', ['alex', 'rich'])
    expect(view.currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Rich'])
  })

  it('refuses someone who is not in the crew', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.startGame(token, 'sam', ['alex', 'rich']))).toBe(403)
  })

  it('refuses fewer than two players', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(rejection(() => service.startGame(token, 'alex', ['alex']))).toBe(400)
  })
})

describe('sealList', () => {
  it('stores the list normalized', () => {
    const { token } = crewWithGame()
    const view = service.sealList(token, 'alex', '  Captain \r\n Intercessors \n\n')
    expect(view.currentGame?.entries.find((entry) => entry.isViewer)?.list).toBe(normalizeList('  Captain \r\n Intercessors \n\n'))
  })

  it('replaces an earlier list while the game is still collecting', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'first draft')
    const view = service.sealList(token, 'alex', 'second draft')
    expect(view.currentGame?.entries.find((entry) => entry.isViewer)?.list).toBe('second draft')
  })

  it('hides a sealed list from the other players', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'Alex list')
    const view = service.crewView(token, 'rich')
    expect(view.currentGame?.entries.find((entry) => entry.name === 'Alex')?.list).toBeNull()
  })

  it('keeps the game collecting while anyone is outstanding', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'Alex list')
    expect(service.sealList(token, 'rich', 'Rich list').currentGame?.status).toBe('collecting')
  })

  it('reveals every list when the last one lands', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    const view = service.sealList(token, 'dan', 'Dan list')
    expect(view.currentGame?.entries.map((entry) => entry.list)).toEqual(['Alex list', 'Dan list', 'Rich list'])
  })

  it('keeps the revealed game on the crew page rather than in history', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(service.crewView(token, 'alex').pastGames).toEqual([])
  })

  it('rejects a list once the game is revealed', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(rejection(() => service.sealList(token, 'alex', 'sneaky rewrite'))).toBe(409)
  })

  it('rejects a list from a member sitting the game out', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    expect(rejection(() => service.sealList(token, 'dan', 'Dan list'))).toBe(403)
  })

  it('rejects a list that is only whitespace', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.sealList(token, 'alex', '  \n \n'))).toBe(400)
  })
})

describe('joinGame', () => {
  it('lets someone left out join the running game', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    const view = service.joinGame(token, 'dan', 'dan')
    expect(view.currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Dan', 'Rich'])
  })

  it('lets one player add another', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    expect(service.joinGame(token, 'alex', 'dan').currentGame?.entries.some((entry) => entry.name === 'Dan')).toBe(true)
  })

  it('leaves the joiner owing a list', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    service.joinGame(token, 'dan', 'dan')
    expect(service.crewView(token, 'dan').currentGame?.viewerSealed).toBe(false)
  })

  it('refuses someone already in the game', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.joinGame(token, 'alex', 'alex'))).toBe(409)
  })

  it('refuses someone who is not in the crew', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.joinGame(token, 'alex', 'sam'))).toBe(404)
  })

  it('refuses to join a revealed game', () => {
    const { token } = crewWithGame()
    service.dropPlayer(token, 'alex', 'dan')
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    expect(rejection(() => service.joinGame(token, 'alex', 'dan'))).toBe(409)
  })
})

describe('dropPlayer', () => {
  it('reveals the game when the dropped player was the only one outstanding', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    expect(service.dropPlayer(token, 'alex', 'dan').currentGame?.status).toBe('revealed')
  })

  it('refuses to drop a player who has already sealed', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'Alex list')
    expect(rejection(() => service.dropPlayer(token, 'rich', 'alex'))).toBe(409)
  })

  it('refuses to drop below two players', () => {
    const { token } = crewWithGame()
    service.dropPlayer(token, 'alex', 'dan')
    expect(rejection(() => service.dropPlayer(token, 'alex', 'rich'))).toBe(409)
  })
})

describe('removeMember', () => {
  it('takes them off the crew roster', () => {
    const { token } = crewWithGame()
    expect(service.removeMember(token, 'alex', 'dan').members.map((member) => member.name)).toEqual(['Alex', 'Rich'])
  })

  it('drops them out of the game still collecting', () => {
    const { token } = crewWithGame()
    expect(service.removeMember(token, 'alex', 'dan').currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Rich'])
  })

  it('reveals the game when they were the only one outstanding', () => {
    const { token } = crewWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    expect(service.removeMember(token, 'alex', 'dan').currentGame?.status).toBe('revealed')
  })

  it('leaves their list in a game that already revealed', () => {
    const { token } = crewWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.removeMember(token, 'alex', 'dan')
    const revealed = service.crewView(token, 'alex').currentGame
    expect(revealed?.entries.find((entry) => entry.name === 'Dan')?.list).toBe('dan list')
  })

  it('lets someone leave a crew themselves', () => {
    const { token } = crewWithGame()
    service.removeMember(token, 'dan', 'dan')
    expect(service.myCrews('dan')).toEqual([])
  })

  it('refuses to leave the crew with fewer than two players', () => {
    const { token } = crewWithGame()
    service.removeMember(token, 'alex', 'dan')
    expect(rejection(() => service.removeMember(token, 'alex', 'rich'))).toBe(409)
  })

  it('refuses someone who is not in the crew', () => {
    const { token } = crewWithGame()
    expect(rejection(() => service.removeMember(token, 'sam', 'dan'))).toBe(403)
  })
})
