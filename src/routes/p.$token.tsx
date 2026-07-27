import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { LIST_MAX_LENGTH, shortFingerprint } from '../core/list'
import type { GameView } from '../core/types'
import { GameHeader } from '../client/components/GameHeader'
import { RevealedLists } from '../client/components/RevealedLists'
import { playerGameQuery } from '../client/queries'
import { errorMessage } from '../client/queryClient'
import { sealList } from '../server/fns'

export const Route = createFileRoute('/p/$token')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(playerGameQuery(params.token)),
  component: PlayerPage,
})

function PlayerPage() {
  const { token } = Route.useParams()
  const { data: game } = useSuspenseQuery(playerGameQuery(token))
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)

  const seal = useMutation({
    mutationFn: (list: string) => sealList({ data: { token, list } }),
    onSuccess: (view) => {
      queryClient.setQueryData(playerGameQuery(token).queryKey, view)
      setDraft(null)
    },
  })

  const me = game.players.find((player) => player.isViewer)
  if (!me) throw new Error('this link is not seated in the game')

  if (game.status === 'revealed') {
    return (
      <main>
        <GameHeader game={game} />
        <RevealedLists game={game} />
      </main>
    )
  }

  const editing = draft !== null || me.list === null

  return (
    <main>
      <GameHeader game={game} />

      {editing ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            seal.mutate(draft ?? '')
          }}
        >
          <textarea
            className="field min-h-72 font-mono text-sm"
            value={draft ?? ''}
            maxLength={LIST_MAX_LENGTH}
            aria-label="Your list"
            placeholder="Paste your list…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <button type="submit" className="button-primary" disabled={!draft?.trim() || seal.isPending}>
              {seal.isPending ? 'Sealing…' : 'Seal it'}
            </button>
            {me.list !== null && (
              <button type="button" className="button-quiet" onClick={() => setDraft(null)}>
                Cancel
              </button>
            )}
          </div>
          {seal.isError && <p className="text-sm text-seal">{errorMessage(seal.error)}</p>}
          <p className="text-sm text-faint">Hidden from everyone, including the host, until the last list is in.</p>
        </form>
      ) : (
        <section className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 border-b border-edge px-4 py-3">
              <span className="font-display text-sm tracking-[0.14em] text-moss uppercase">Sealed</span>
              <span className="font-mono text-xs text-faint" title={me.listHash ?? undefined}>
                {me.listHash && shortFingerprint(me.listHash)}
              </span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{me.list}</pre>
          </div>
          <button type="button" className="button-quiet" onClick={() => setDraft(me.list ?? '')}>
            Replace
          </button>
          <Waiting game={game} />
        </section>
      )}
    </main>
  )
}

function Waiting({ game }: { game: GameView }) {
  const outstanding = game.players.filter((player) => !player.sealed)
  if (outstanding.length === 0) return null
  return (
    <p className="text-sm text-faint">
      You can replace it until the last list is in. Waiting on {outstanding.map((player) => player.name).join(', ')}.
    </p>
  )
}
