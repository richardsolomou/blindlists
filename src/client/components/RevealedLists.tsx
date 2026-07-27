import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GameView } from '../../core/game'

export function RevealedLists({ game }: { game: GameView }) {
  return (
    <div className="space-y-4">
      {game.entries.map((entry, index) => (
        <Card key={entry.userId} className="unseal" style={{ animationDelay: `${index * 70}ms` }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 font-display text-lg">
              <span className="stamp-revealed" aria-hidden="true" />
              {entry.name}
              {entry.isViewer && <span className="text-xs tracking-[0.14em] text-faint uppercase">you</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">{entry.list}</pre>
          </CardContent>
        </Card>
      ))}
      <p className="text-sm text-faint">These are locked. Nobody can change one now.</p>
    </div>
  )
}
