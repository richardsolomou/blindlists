import type { EmailDelivery } from '../adapters/email'
import type { Repository } from '../db/repository'
import { gameRevealedEmail, gameStartedEmail } from './emails'

/** The two moments worth an email: your list is due, and every list is in. */
export type Notifier = {
  gameStarted: (gameId: string, startedBy: string) => void
  gameRevealed: (gameId: string) => void
}

/** Fire and forget: a game must not fail because a mail server is down. */
function detach(work: () => Promise<void>) {
  void work().catch((error) => console.error({ event: 'notification_failed', error }))
}

function report(results: PromiseSettledResult<unknown>[]) {
  for (const result of results) {
    if (result.status === 'rejected') console.error({ event: 'notification_failed', error: result.reason })
  }
}

export function buildNotifier(repository: Repository, email: EmailDelivery, appUrl: () => string): Notifier {
  const crewLink = (gameId: string) => {
    const crew = repository.crewOfGame(gameId)
    return crew ? { crew, url: `${appUrl()}/c/${crew.token}` } : undefined
  }

  return {
    gameStarted: (gameId, startedBy) =>
      detach(async () => {
        const target = crewLink(gameId)
        const game = target && repository.gameById(target.crew.id, gameId)
        if (!target || !game) return
        const sends = repository
          .mailableInGame(gameId, startedBy)
          .map((player) => email.send(gameStartedEmail(player.email, target.crew.name, game.number, target.url)))
        report(await Promise.allSettled(sends))
      }),
    gameRevealed: (gameId) =>
      detach(async () => {
        const target = crewLink(gameId)
        const game = target && repository.gameById(target.crew.id, gameId)
        if (!target || !game) return
        const sends = repository
          .mailableInGame(gameId)
          .map((player) => email.send(gameRevealedEmail(player.email, target.crew.name, game.number, target.url)))
        report(await Promise.allSettled(sends))
      }),
  }
}
