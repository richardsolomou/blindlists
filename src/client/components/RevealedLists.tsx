import { RETENTION_DAYS } from '../../core/game'
import { shortFingerprint } from '../../core/game'
import type { GameView } from '../../core/game'

export function RevealedLists({ game }: { game: GameView }) {
  return (
    <section className="space-y-4">
      {game.players.map((player) => (
        <article key={player.id} className="panel overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 border-b border-edge px-4 py-3">
            <h2 className="text-lg">
              {player.name}
              {player.isViewer && <span className="ml-2 text-xs tracking-[0.14em] text-faint uppercase">you</span>}
            </h2>
            <span className="font-mono text-xs text-faint" title={player.listHash ?? undefined}>
              {player.listHash && shortFingerprint(player.listHash)}
            </span>
          </div>
          <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{player.list}</pre>
        </article>
      ))}
      <p className="text-sm text-faint">
        Locked for good. Each fingerprint is the SHA-256 of the list beside it, so a changed list would show a changed fingerprint. This
        game is deleted {RETENTION_DAYS} days after it was created.
      </p>
    </section>
  )
}
