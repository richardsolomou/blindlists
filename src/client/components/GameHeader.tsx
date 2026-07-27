import type { GameView } from '../../core/types'

export function GameHeader({ game }: { game: GameView }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl">{game.name}</h1>
      <p className="mt-2 font-display text-sm tracking-[0.14em] uppercase">
        {game.status === 'revealed' ? (
          <span className="text-brass">Revealed &amp; locked</span>
        ) : (
          <span className="text-faint">
            <span className="text-parchment">
              {game.sealed} of {game.total}
            </span>{' '}
            sealed
          </span>
        )}
      </p>
    </header>
  )
}
