import type { GameView } from '../../core/game'

export function GameHeader({ game }: { game: GameView }) {
  const revealed = game.status === 'revealed'
  return (
    <header className="mb-5">
      <p className="eyebrow">Game {game.number}</p>
      <h2 className="mt-1 flex items-center gap-2.5 text-2xl">
        <span className={revealed ? 'stamp-revealed' : 'stamp-waiting'} aria-hidden="true" />
        {revealed ? (
          <span className="text-brass">Revealed</span>
        ) : (
          <span>
            {game.sealed} of {game.total} sealed
          </span>
        )}
      </h2>
      {!revealed && <p className="mt-1 text-sm text-faint">Every list opens the moment the last one lands.</p>}
    </header>
  )
}
