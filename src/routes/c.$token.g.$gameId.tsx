import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { GameHeader } from '../client/components/GameHeader'
import { RevealedLists } from '../client/components/RevealedLists'
import { gameQuery } from '../client/queries'

export const Route = createFileRoute('/c/$token/g/$gameId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(gameQuery(params.token, params.gameId)),
  component: GamePage,
})

function GamePage() {
  const { token, gameId } = Route.useParams()
  const { data: game } = useSuspenseQuery(gameQuery(token, gameId))

  return (
    <main>
      <p className="mb-6">
        <Link to="/c/$token" params={{ token }} className="text-sm text-faint underline hover:text-brass">
          Back to the crew
        </Link>
      </p>
      <GameHeader game={game} />
      {game.status === 'revealed' ? (
        <RevealedLists game={game} />
      ) : (
        <p className="text-faint">
          This game is still collecting lists.{' '}
          <Link to="/c/$token" params={{ token }} className="text-brass underline">
            Open the crew page
          </Link>{' '}
          to seal yours.
        </p>
      )}
    </main>
  )
}
