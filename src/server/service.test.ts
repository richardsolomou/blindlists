import { beforeEach, describe, expect, it } from 'vitest'
import type { GroupEvents } from '../adapters/events'
import { normalizeList } from '../core/game'
import { openDatabase, type SealedListsDatabase } from '../db/connection'
import { Repository } from '../db/repository'
import { user } from '../db/schema'
import { SealedListsService } from './service'
import type { Notifier } from './notify'

let database: SealedListsDatabase
let service: SealedListsService
let notified: string[]
let changed: string[]
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
  notified = []
  changed = []
  database = openDatabase(':memory:')
  const notifier: Notifier = {
    gameStarted: (gameId, startedBy) => notified.push(`started:${startedBy}`),
    gameRevealed: () => notified.push('revealed'),
  }
  const events: GroupEvents = { publish: (groupId) => changed.push(groupId), subscribe: () => () => {} }
  service = new SealedListsService(new Repository(database), () => now, notifier, events)
  for (const name of ['Alex', 'Rich', 'Dan', 'Sam']) makeUser(name.toLowerCase(), name)
})

/** A group of three with a game running and everyone in it. */
function groupWithGame() {
  const { token } = service.createGroup('alex', 'Tuesday night')
  service.joinGroup(token, 'rich')
  service.joinGroup(token, 'dan')
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

describe('createGroup', () => {
  it('puts the creator in the group', () => {
    const { token } = service.createGroup('alex', 'Tuesday night')
    expect(service.groupView(token, 'alex').members.map((member) => member.name)).toEqual(['Alex'])
  })

  it('starts with no game', () => {
    const { token } = service.createGroup('alex', 'Tuesday night')
    expect(service.groupView(token, 'alex').currentGame).toBeNull()
  })

  it('rejects an unknown group link', () => {
    expect(rejection(() => service.groupView('not-a-token', 'alex'))).toBe(404)
  })
})

describe('myGroups', () => {
  it('lists the groups you belong to', () => {
    service.createGroup('alex', 'Tuesday night')
    now += 10
    service.createGroup('alex', 'Saturday campaign')
    expect(service.myGroups('alex').map((group) => group.name)).toEqual(['Saturday campaign', 'Tuesday night'])
  })

  it('leaves out groups you are not in', () => {
    service.createGroup('alex', 'Tuesday night')
    expect(service.myGroups('rich')).toEqual([])
  })

  it('flags a group where you still owe a list', () => {
    groupWithGame()
    expect(service.myGroups('rich')[0].needsList).toBe(true)
  })

  it('stops flagging once you have sealed', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'rich', 'Rich list')
    expect(service.myGroups('rich')[0].needsList).toBe(false)
  })
})

describe('a link holder who has not joined', () => {
  it('sees the group name and who is in it', () => {
    const { token } = groupWithGame()
    expect(service.groupView(token, 'sam').members.map((member) => member.name)).toEqual(['Alex', 'Dan', 'Rich'])
  })

  it('is told they are not a member', () => {
    const { token } = groupWithGame()
    expect(service.groupView(token, 'sam').isMember).toBe(false)
  })

  it('is shown no game at all', () => {
    const { token } = groupWithGame()
    expect(service.groupView(token, 'sam').currentGame).toBeNull()
  })

  it('cannot open a game directly', () => {
    const { token } = groupWithGame()
    const gameId = service.groupView(token, 'alex').currentGame!.id
    expect(rejection(() => service.gameView(token, gameId, 'sam'))).toBe(403)
  })

  it('cannot seal a list', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.sealList(token, 'sam', 'Sam list'))).toBe(403)
  })

  it('becomes a member by joining', () => {
    const { token } = groupWithGame()
    expect(service.joinGroup(token, 'sam').isMember).toBe(true)
  })

  it('is not added to a game that is already running', () => {
    const { token } = groupWithGame()
    expect(service.joinGroup(token, 'sam').currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Dan', 'Rich'])
  })
})

describe('startGame', () => {
  it('numbers games in sequence', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    expect(service.groupView(token, 'alex').currentGame?.number).toBe(2)
  })

  it('refuses a second game while one is collecting', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.startGame(token, 'alex', ['alex', 'rich']))).toBe(409)
  })

  it('lets a member sit a game out', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    const view = service.startGame(token, 'alex', ['alex', 'rich'])
    expect(view.currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Rich'])
  })

  it('refuses someone who is not in the group', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.startGame(token, 'sam', ['alex', 'rich']))).toBe(403)
  })

  it('refuses fewer than two players', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(rejection(() => service.startGame(token, 'alex', ['alex']))).toBe(400)
  })
})

describe('sealList', () => {
  it('stores the list normalized', () => {
    const { token } = groupWithGame()
    const view = service.sealList(token, 'alex', '  Captain \r\n Intercessors \n\n')
    expect(view.currentGame?.entries.find((entry) => entry.isViewer)?.list).toBe(normalizeList('  Captain \r\n Intercessors \n\n'))
  })

  it('replaces an earlier list while the game is still collecting', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'first draft')
    const view = service.sealList(token, 'alex', 'second draft')
    expect(view.currentGame?.entries.find((entry) => entry.isViewer)?.list).toBe('second draft')
  })

  it('hides a sealed list from the other players', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    const view = service.groupView(token, 'rich')
    expect(view.currentGame?.entries.find((entry) => entry.name === 'Alex')?.list).toBeNull()
  })

  it('keeps the game collecting while anyone is outstanding', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    expect(service.sealList(token, 'rich', 'Rich list').currentGame?.status).toBe('collecting')
  })

  it('reveals every list when the last one lands', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    const view = service.sealList(token, 'dan', 'Dan list')
    expect(view.currentGame?.entries.map((entry) => entry.list)).toEqual(['Alex list', 'Dan list', 'Rich list'])
  })

  it('keeps the revealed game on the group page rather than in history', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(service.groupView(token, 'alex').pastGames).toEqual([])
  })

  it('rejects a list once the game is revealed', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(rejection(() => service.sealList(token, 'alex', 'sneaky rewrite'))).toBe(409)
  })

  it('rejects a list from a member sitting the game out', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    expect(rejection(() => service.sealList(token, 'dan', 'Dan list'))).toBe(403)
  })

  it('rejects a list that is only whitespace', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.sealList(token, 'alex', '  \n \n'))).toBe(400)
  })
})

describe('joinGame', () => {
  it('lets someone left out join the running game', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    const view = service.joinGame(token, 'dan', 'dan')
    expect(view.currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Dan', 'Rich'])
  })

  it('lets one player add another', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    expect(service.joinGame(token, 'alex', 'dan').currentGame?.entries.some((entry) => entry.name === 'Dan')).toBe(true)
  })

  it('leaves the joiner owing a list', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    service.joinGame(token, 'dan', 'dan')
    expect(service.groupView(token, 'dan').currentGame?.viewerSealed).toBe(false)
  })

  it('refuses someone already in the game', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.joinGame(token, 'alex', 'alex'))).toBe(409)
  })

  it('refuses someone who is not in the group', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.joinGame(token, 'alex', 'sam'))).toBe(404)
  })

  it('refuses to join a revealed game', () => {
    const { token } = groupWithGame()
    service.dropPlayer(token, 'alex', 'dan')
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    expect(rejection(() => service.joinGame(token, 'alex', 'dan'))).toBe(409)
  })
})

describe('dropPlayer', () => {
  it('reveals the game when the dropped player was the only one outstanding', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    expect(service.dropPlayer(token, 'alex', 'dan').currentGame?.status).toBe('revealed')
  })

  it('refuses to drop a player who has already sealed', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    expect(rejection(() => service.dropPlayer(token, 'rich', 'alex'))).toBe(409)
  })

  it('refuses to drop below two players', () => {
    const { token } = groupWithGame()
    service.dropPlayer(token, 'alex', 'dan')
    expect(rejection(() => service.dropPlayer(token, 'alex', 'rich'))).toBe(409)
  })
})

describe('removeMember', () => {
  it('takes them off the group roster', () => {
    const { token } = groupWithGame()
    expect(service.removeMember(token, 'alex', 'dan').members.map((member) => member.name)).toEqual(['Alex', 'Rich'])
  })

  it('drops them out of the game still collecting', () => {
    const { token } = groupWithGame()
    expect(service.removeMember(token, 'alex', 'dan').currentGame?.entries.map((entry) => entry.name)).toEqual(['Alex', 'Rich'])
  })

  it('reveals the game when they were the only one outstanding', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    expect(service.removeMember(token, 'alex', 'dan').currentGame?.status).toBe('revealed')
  })

  it('leaves their list in a game that already revealed', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.removeMember(token, 'alex', 'dan')
    const revealed = service.groupView(token, 'alex').currentGame
    expect(revealed?.entries.find((entry) => entry.name === 'Dan')?.list).toBe('dan list')
  })

  it('lets someone leave a group themselves', () => {
    const { token } = groupWithGame()
    service.removeMember(token, 'dan', 'dan')
    expect(service.myGroups('dan')).toEqual([])
  })

  it('lets the second-to-last player leave, so a pair is never stuck together', () => {
    const { token } = groupWithGame()
    service.removeMember(token, 'alex', 'dan')
    expect(service.removeMember(token, 'rich', 'rich').members.map((member) => member.name)).toEqual(['Alex'])
  })

  it('refuses to empty the group', () => {
    const { token } = service.createGroup('alex', 'Tuesday night')
    expect(rejection(() => service.removeMember(token, 'alex', 'alex'))).toBe(409)
  })

  it('refuses someone who is not in the group', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.removeMember(token, 'sam', 'dan'))).toBe(403)
  })
})

describe('notifications', () => {
  it('announces a game once it starts', () => {
    groupWithGame()
    expect(notified).toEqual(['started:alex'])
  })

  it('says nothing while lists are still coming in', () => {
    const { token } = groupWithGame()
    notified.length = 0
    service.sealList(token, 'alex', 'Alex list')
    expect(notified).toEqual([])
  })

  it('announces the reveal when the last list lands', () => {
    const { token } = groupWithGame()
    notified.length = 0
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    expect(notified).toEqual(['revealed'])
  })

  it('announces the reveal when dropping the last outstanding player causes it', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    notified.length = 0
    service.dropPlayer(token, 'alex', 'dan')
    expect(notified).toEqual(['revealed'])
  })

  it('announces the reveal when removing the last outstanding player causes it', () => {
    const { token } = groupWithGame()
    service.sealList(token, 'alex', 'Alex list')
    service.sealList(token, 'rich', 'Rich list')
    notified.length = 0
    service.removeMember(token, 'alex', 'dan')
    expect(notified).toEqual(['revealed'])
  })

  it('does not announce a reveal that has not happened', () => {
    const { token } = groupWithGame()
    notified.length = 0
    service.dropPlayer(token, 'alex', 'dan')
    expect(notified).toEqual([])
  })
})

describe('email preference', () => {
  it('defaults to on', () => {
    expect(service.emailPreference('alex').gameEmails).toBe(true)
  })

  it('remembers being turned off', () => {
    service.setEmailPreference('alex', false)
    expect(service.emailPreference('alex').gameEmails).toBe(false)
  })

  it('can be turned back on', () => {
    service.setEmailPreference('alex', false)
    service.setEmailPreference('alex', true)
    expect(service.emailPreference('alex').gameEmails).toBe(true)
  })
})

describe('live updates', () => {
  it('announces a change when someone joins the group', () => {
    const { token } = service.createGroup('alex', 'Tuesday night')
    changed = []
    service.joinGroup(token, 'rich')
    expect(changed).toHaveLength(1)
  })

  it('announces a change when a list is sealed', () => {
    const { token } = groupWithGame()
    changed = []
    service.sealList(token, 'rich', 'Death Guard')
    expect(changed).toHaveLength(1)
  })

  it('says nothing when a mutation is refused', () => {
    const { token } = groupWithGame()
    changed = []
    rejection(() => service.sealList(token, 'sam', 'Not in this game'))
    expect(changed).toEqual([])
  })

  it('gives a member the group behind their link', () => {
    const { token } = groupWithGame()
    expect(service.memberGroupId(token, 'rich')).toBe(service.memberGroupId(token, 'alex'))
  })

  it('refuses a link holder who has not joined', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.memberGroupId(token, 'sam'))).toBe(403)
  })
})

describe('deleteGame', () => {
  it('takes a revealed game out of history', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    const gameId = service.groupView(token, 'alex').currentGame!.id
    expect(service.deleteGame(token, 'alex', gameId).currentGame).toBeNull()
  })

  it('takes its lists with it', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    const gameId = service.groupView(token, 'alex').currentGame!.id
    service.deleteGame(token, 'alex', gameId)
    expect(rejection(() => service.gameView(token, gameId, 'alex'))).toBe(404)
  })

  it('frees the group to make another game, which is the way out of one nobody will finish', () => {
    const { token } = groupWithGame()
    const gameId = service.groupView(token, 'alex').currentGame!.id
    service.deleteGame(token, 'alex', gameId)
    expect(service.startGame(token, 'alex', ['alex', 'rich']).currentGame?.entries).toHaveLength(2)
  })

  it('numbers the next game from what is left, so deleting the newest leaves no gap', () => {
    const { token } = groupWithGame()
    const first = service.groupView(token, 'alex').currentGame!.id
    service.deleteGame(token, 'alex', first)
    expect(service.startGame(token, 'alex', ['alex', 'rich']).currentGame?.number).toBe(1)
  })

  it('never reuses the number of a game that is still there', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    service.startGame(token, 'alex', ['alex', 'rich'])
    for (const id of ['alex', 'rich']) service.sealList(token, id, `${id} list`)
    const second = service.groupView(token, 'alex').currentGame!.id
    service.deleteGame(token, 'alex', second)
    service.startGame(token, 'alex', ['alex', 'rich'])
    const view = service.groupView(token, 'alex')
    expect({ current: view.currentGame?.number, past: view.pastGames.map((game) => game.number) }).toEqual({ current: 2, past: [1] })
  })

  it('leaves the other games alone', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    const first = service.groupView(token, 'alex').currentGame!.id
    service.startGame(token, 'alex', ['alex', 'rich'])
    const second = service.groupView(token, 'alex').currentGame!.id
    service.deleteGame(token, 'alex', second)
    expect(service.gameView(token, first, 'alex').number).toBe(1)
  })

  it('refuses someone who is not in the group', () => {
    const { token } = groupWithGame()
    const gameId = service.groupView(token, 'alex').currentGame!.id
    expect(rejection(() => service.deleteGame(token, 'sam', gameId))).toBe(403)
  })

  it('refuses a game from another group', () => {
    const { token } = groupWithGame()
    const other = service.createGroup('sam', 'Saturday')
    service.joinGroup(other.token, 'alex')
    service.startGame(other.token, 'sam', ['sam', 'alex'])
    const theirs = service.groupView(other.token, 'sam').currentGame!.id
    expect(rejection(() => service.deleteGame(token, 'alex', theirs))).toBe(404)
  })

  it('announces the change so open pages catch up', () => {
    const { token } = groupWithGame()
    const gameId = service.groupView(token, 'alex').currentGame!.id
    changed = []
    service.deleteGame(token, 'alex', gameId)
    expect(changed).toHaveLength(1)
  })
})

describe('a link that points at nothing', () => {
  it('is not reported as a group', () => {
    expect(service.hasGroup('not-a-token')).toBe(false)
  })

  it('is reported when it is real', () => {
    const { token } = service.createGroup('alex', 'Tuesday night')
    expect(service.hasGroup(token)).toBe(true)
  })
})

describe('deleteGroup', () => {
  it('takes the group off everyone who was in it', () => {
    const { token } = groupWithGame()
    service.deleteGroup(token, 'alex')
    expect([service.myGroups('alex'), service.myGroups('rich')]).toEqual([[], []])
  })

  it('leaves the link pointing at nothing', () => {
    const { token } = groupWithGame()
    service.deleteGroup(token, 'alex')
    expect(service.hasGroup(token)).toBe(false)
  })

  it('takes its games and lists with it', () => {
    const { token } = groupWithGame()
    for (const id of ['alex', 'rich', 'dan']) service.sealList(token, id, `${id} list`)
    const gameId = service.groupView(token, 'alex').currentGame!.id
    service.deleteGroup(token, 'alex')
    expect(rejection(() => service.gameView(token, gameId, 'alex'))).toBe(404)
  })

  it('is the way out for the last player, who cannot leave', () => {
    const { token } = service.createGroup('alex', 'Tuesday night')
    expect(rejection(() => service.removeMember(token, 'alex', 'alex'))).toBe(409)
    service.deleteGroup(token, 'alex')
    expect(service.myGroups('alex')).toEqual([])
  })

  it('refuses someone who only holds the link', () => {
    const { token } = groupWithGame()
    expect(rejection(() => service.deleteGroup(token, 'sam'))).toBe(403)
  })

  it('leaves another group alone', () => {
    const { token } = groupWithGame()
    const other = service.createGroup('alex', 'Saturday')
    service.deleteGroup(token, 'alex')
    expect(service.myGroups('alex').map((group) => group.name)).toEqual(['Saturday'])
    expect(service.hasGroup(other.token)).toBe(true)
  })

  it('announces the change so the others find out', () => {
    const { token } = groupWithGame()
    changed = []
    service.deleteGroup(token, 'alex')
    expect(changed).toHaveLength(1)
  })
})
