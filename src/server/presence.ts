/** How long a "typing" flag survives without being renewed. */
const TYPING_TTL_MS = 6_000

export type PresentPlayer = { userId: string; name: string; typing: boolean }

type Watcher = { userId: string; name: string; streams: number; typingUntil: number }

/**
 * Who has a group page open, and who is writing in it right now.
 *
 * Presence is the live state of the event streams, so it is held in memory and
 * never in SQLite: a row would outlive the tab it describes. Being here is
 * counted per stream, so a second tab does not remove you when you close the
 * first. Nothing about a list passes through here — only names, and a flag.
 */
export class Presence {
  private groups = new Map<string, Map<string, Watcher>>()
  private listeners = new Map<string, Set<(present: PresentPlayer[]) => void>>()
  private sweeps = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private readonly clock: () => number = Date.now) {}

  /** Marks someone present until the returned function is called. */
  arrive(groupId: string, player: { userId: string; name: string }, listener?: (present: PresentPlayer[]) => void) {
    const watchers = this.groups.get(groupId) ?? new Map<string, Watcher>()
    const existing = watchers.get(player.userId)
    watchers.set(player.userId, {
      userId: player.userId,
      name: player.name,
      streams: (existing?.streams ?? 0) + 1,
      typingUntil: existing?.typingUntil ?? 0,
    })
    this.groups.set(groupId, watchers)

    if (listener) {
      const listeners = this.listeners.get(groupId) ?? new Set<(present: PresentPlayer[]) => void>()
      listeners.add(listener)
      this.listeners.set(groupId, listeners)
    }
    this.announce(groupId)

    let left = false
    return () => {
      if (left) return
      left = true
      if (listener) {
        const listeners = this.listeners.get(groupId)
        listeners?.delete(listener)
        if (!listeners?.size) this.listeners.delete(groupId)
      }
      const active = this.groups.get(groupId)
      const watcher = active?.get(player.userId)
      if (watcher && watcher.streams > 1) watcher.streams--
      else active?.delete(player.userId)
      if (!active?.size) this.groups.delete(groupId)
      this.announce(groupId)
    }
  }

  /** Renews or clears a typing flag. Unknown watchers are ignored: they have no page open. */
  typing(groupId: string, userId: string, typing: boolean) {
    const watcher = this.groups.get(groupId)?.get(userId)
    if (!watcher) return
    watcher.typingUntil = typing ? this.clock() + TYPING_TTL_MS : 0
    this.announce(groupId)
    // A page that stops typing says so, but a page that crashes cannot, so the
    // flag is also swept once its window is up.
    if (typing) this.sweepAfter(groupId)
  }

  present(groupId: string): PresentPlayer[] {
    const now = this.clock()
    return [...(this.groups.get(groupId)?.values() ?? [])]
      .map((watcher) => ({ userId: watcher.userId, name: watcher.name, typing: watcher.typingUntil > now }))
      .toSorted((left, right) => left.name.localeCompare(right.name) || left.userId.localeCompare(right.userId))
  }

  private announce(groupId: string) {
    const present = this.present(groupId)
    for (const listener of this.listeners.get(groupId) ?? []) listener(present)
  }

  private sweepAfter(groupId: string) {
    clearTimeout(this.sweeps.get(groupId))
    const sweep = setTimeout(() => {
      this.sweeps.delete(groupId)
      this.announce(groupId)
    }, TYPING_TTL_MS + 100)
    sweep.unref?.()
    this.sweeps.set(groupId, sweep)
  }
}
