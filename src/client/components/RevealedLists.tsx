import type { GameView } from '../../core/game'

export function RevealedLists({ game }: { game: GameView }) {
  return (
    <section className="space-y-4">
      {game.entries.map((entry, index) => (
        <article key={entry.userId} className="panel unseal overflow-hidden" style={{ animationDelay: `${index * 70}ms` }}>
          <h2 className="flex items-center gap-2.5 border-b border-edge px-4 py-3 text-lg">
            <span className="stamp-revealed" aria-hidden="true" />
            {entry.name}
            {entry.isViewer && <span className="text-xs tracking-[0.14em] text-faint uppercase">you</span>}
          </h2>
          <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{entry.list}</pre>
        </article>
      ))}
      <p className="text-sm text-faint">Nobody can change a list now.</p>
    </section>
  )
}
