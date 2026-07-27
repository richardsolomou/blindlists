import type { GameView } from '../../core/game'

export function GameHeader({ game }: { game: GameView }) {
  return (
    <header className="mb-5">
      <h2 className="text-2xl">Game {game.number}</h2>
      <p className="mt-1 font-display text-sm tracking-[0.14em] uppercase">
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
