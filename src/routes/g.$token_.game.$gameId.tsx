import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DeleteGameButton } from '../client/components/DeleteGameButton'
import { RevealedLists } from '../client/components/RevealedLists'
import { gameQuery } from '../client/queries'

// The trailing underscore keeps the URL but lifts this out from under
// `/g/$token`, which is a whole page with no outlet for a child to render in.
export const Route = createFileRoute('/g/$token_/game/$gameId')({
  loader: async ({ context, params }) => {
    if (!(await context.queryClient.ensureQueryData(gameQuery(params.token, params.gameId)))) throw notFound()
  },
  component: GamePage,
})

function GamePage() {
  const { token, gameId } = Route.useParams()
  const { data: game } = useSuspenseQuery(gameQuery(token, gameId))
  const navigate = useNavigate()
  if (!game) throw notFound()

  return (
    <main>
      <Link to="/g/$token" params={{ token }} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 -ml-2 text-faint')}>
        <ArrowLeft />
        Back
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Game {game.number}</h1>
        <DeleteGameButton
          token={token}
          gameId={gameId}
          number={game.number}
          onDeleted={() => void navigate({ to: '/g/$token', params: { token } })}
        />
      </div>
      {game.status === 'revealed' ? (
        <RevealedLists game={game} />
      ) : (
        <p className="text-faint">
          This one is still collecting lists.{' '}
          <Link to="/g/$token" params={{ token }} className="text-brass underline underline-offset-4">
            Go seal yours
          </Link>
          .
        </p>
      )}
    </main>
  )
}
