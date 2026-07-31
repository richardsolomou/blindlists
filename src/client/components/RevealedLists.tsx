import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EntryView, GameView } from '../../core/game'

export function RevealedLists({ game }: { game: GameView }) {
  return (
    <div className="space-y-4">
      {game.entries.map((entry, index) => (
        <RevealedList key={entry.userId} entry={entry} animationDelay={index * 70} />
      ))}
      <p className="text-sm text-faint">These are locked. Nobody can change one now.</p>
    </div>
  )
}

function RevealedList({ entry, animationDelay }: { entry: EntryView; animationDelay: number }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = `list-${entry.userId}`

  return (
    <Card className="unseal" style={{ animationDelay: `${animationDelay}ms` }}>
      <button
        type="button"
        className="cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
      >
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <CardTitle className="flex items-center gap-2.5 font-display text-lg">
            <span className="stamp-revealed" aria-hidden="true" />
            {entry.name}
            {entry.isViewer && <span className="text-xs tracking-[0.14em] text-faint uppercase">you</span>}
          </CardTitle>
          <ChevronDown className={`size-5 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </CardHeader>
      </button>
      {expanded && (
        <CardContent id={contentId}>
          <pre className="overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">{entry.list}</pre>
        </CardContent>
      )}
    </Card>
  )
}
