import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { PlayerView } from '../core/types'
import { CopyButton } from '../client/components/CopyButton'
import { GameHeader } from '../client/components/GameHeader'
import { RevealedLists } from '../client/components/RevealedLists'
import { hostGameQuery } from '../client/queries'
import { errorMessage } from '../client/queryClient'
import { useOrigin } from '../client/useOrigin'
import { dropPlayer } from '../server/fns'

export const Route = createFileRoute('/host/$token')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(hostGameQuery(params.token)),
  component: HostPage,
})

function HostPage() {
  const { token } = Route.useParams()
  const { data: game } = useSuspenseQuery(hostGameQuery(token))
  const queryClient = useQueryClient()

  const drop = useMutation({
    mutationFn: (playerId: string) => dropPlayer({ data: { token, playerId } }),
    onSuccess: (view) => queryClient.setQueryData(hostGameQuery(token).queryKey, view),
  })

  if (game.status === 'revealed') {
    return (
      <main>
        <GameHeader game={game} />
        <RevealedLists game={game} />
      </main>
    )
  }

  return (
    <main>
      <GameHeader game={game} />
      <ul className="divide-y divide-edge border-y border-edge">
        {game.players.map((player) => (
          <Seat
            key={player.id}
            player={player}
            canDrop={game.players.length > 2}
            dropping={drop.isPending}
            onDrop={() => drop.mutate(player.id)}
          />
        ))}
      </ul>
      {drop.isError && <p className="mt-3 text-sm text-seal">{errorMessage(drop.error)}</p>}
      <p className="mt-8 text-sm text-faint">
        Send each player their link. This page is the only place they live, and it never shows you a list.
      </p>
    </main>
  )
}

function Seat({ player, canDrop, dropping, onDrop }: { player: PlayerView; canDrop: boolean; dropping: boolean; onDrop: () => void }) {
  const origin = useOrigin()
  const link = player.inviteToken ? `${origin}/p/${player.inviteToken}` : ''

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1 truncate">{player.name}</span>
      <span className={`font-display text-xs tracking-[0.14em] uppercase ${player.sealed ? 'text-moss' : 'text-faint'}`}>
        {player.sealed ? 'sealed' : 'waiting'}
      </span>
      <CopyButton value={link} label="Copy link" description={`Copy the invite link for ${player.name}`} />
      {!player.sealed && canDrop && (
        <button
          type="button"
          className="button-quiet"
          disabled={dropping}
          onClick={() => {
            if (confirm(`Drop ${player.name}? Their seat is removed for good.`)) onDrop()
          }}
        >
          Drop
        </button>
      )}
    </li>
  )
}
