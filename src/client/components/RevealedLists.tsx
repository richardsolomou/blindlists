import type { GameView } from '../../core/game'

export function RevealedLists({ game }: { game: GameView }) {
  return (
    <section className="space-y-4">
      {game.entries.map((entry) => (
        <article key={entry.memberId} className="panel overflow-hidden">
          <h2 className="border-b border-edge px-4 py-3 text-lg">
            {entry.name}
            {entry.isViewer && <span className="ml-2 text-xs tracking-[0.14em] text-faint uppercase">you</span>}
          </h2>
          <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{entry.list}</pre>
        </article>
      ))}
      <p className="text-sm text-faint">Nobody can change a list now.</p>
    </section>
  )
}
