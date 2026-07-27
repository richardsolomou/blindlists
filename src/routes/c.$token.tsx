import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { LIST_MAX_LENGTH, canRemoveMember } from '../core/game'
import type { CrewMember, CrewView, EntryView, GameView } from '../core/game'
import { CopyButton } from '../client/components/CopyButton'
import { GameHeader } from '../client/components/GameHeader'
import { RevealedLists } from '../client/components/RevealedLists'
import { crewQuery, meQuery } from '../client/queries'
import { errorMessage } from '../client/queryClient'
import { useOrigin } from '../client/useOrigin'
import { dropPlayer, joinCrew, joinGame, removeMember, sealList, startGame } from '../server/fns'

export const Route = createFileRoute('/c/$token')({
  loader: async ({ context, params }) => {
    const [crew] = await Promise.all([
      context.queryClient.ensureQueryData(crewQuery(params.token)),
      context.queryClient.ensureQueryData(meQuery()),
    ])
    if (crew === null) throw notFound()
  },
  component: CrewPage,
})

/** Every mutation returns the whole crew view, so the page just swaps its state. */
function useCrewMutation<TInput>(token: string, call: (input: TInput) => Promise<CrewView>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: (view) => queryClient.setQueryData(crewQuery(token).queryKey, view),
  })
}

function CrewPage() {
  const { token } = Route.useParams()
  const { data: crew } = useSuspenseQuery(crewQuery(token))
  const { data: viewer } = useSuspenseQuery(meQuery())

  if (crew === 'signed-out' || !viewer) return <SignInFirst token={token} />
  if (!crew) throw notFound()

  return (
    <main>
      <header className="mb-8 border-b border-edge pb-4">
        <h1 className="text-3xl">{crew.name}</h1>
      </header>
      {crew.isMember ? <CrewBody token={token} crew={crew} viewerId={viewer.id} /> : <JoinCrew token={token} crew={crew} />}
    </main>
  )
}

function SignInFirst({ token }: { token: string }) {
  return (
    <main className="max-w-md">
      <h1 className="text-3xl">You have been sent a crew</h1>
      <p className="mt-3 mb-6 text-faint">Sign in and you can join it. Your lists follow your account, on any device.</p>
      <Link to="/signin" search={{ next: `/c/${token}` }} className="button-primary">
        Sign in
      </Link>
    </main>
  )
}

function JoinCrew({ token, crew }: { token: string; crew: CrewView }) {
  const join = useCrewMutation(token, () => joinCrew({ data: { token } }))
  return (
    <section>
      <p className="mb-5 text-faint">
        {crew.members.length === 0
          ? 'Nobody has joined yet.'
          : `${crew.members.map((member) => member.name).join(', ')} ${crew.members.length === 1 ? 'is' : 'are'} in this crew.`}
      </p>
      <button type="button" className="button-primary" disabled={join.isPending} onClick={() => join.mutate(undefined)}>
        {join.isPending ? 'Joining…' : 'Join this crew'}
      </button>
      {join.isError && <p className="mt-3 text-sm text-seal">{errorMessage(join.error)}</p>}
    </section>
  )
}

function CrewBody({ token, crew, viewerId }: { token: string; crew: CrewView; viewerId: string }) {
  return (
    <div className="space-y-10">
      {crew.currentGame && <CurrentGame token={token} game={crew.currentGame} members={crew.members} viewerId={viewerId} />}
      {crew.canStartGame && <StartGame token={token} members={crew.members} />}
      <History token={token} crew={crew} />
      <CrewFooter token={token} crew={crew} viewerId={viewerId} />
    </div>
  )
}

function CurrentGame({ token, game, members, viewerId }: { token: string; game: GameView; members: CrewMember[]; viewerId: string }) {
  const roster = <Roster token={token} game={game} members={members} />
  return (
    <section>
      <GameHeader game={game} />
      {game.status === 'revealed' ? (
        <RevealedLists game={game} />
      ) : game.viewerSealed === null ? (
        <>
          <SittingOut token={token} viewerId={viewerId} />
          {roster}
        </>
      ) : game.viewerSealed ? (
        <Sealed token={token} game={game} roster={roster} />
      ) : (
        <SealForm token={token} roster={roster} />
      )}
    </section>
  )
}

function SittingOut({ token, viewerId }: { token: string; viewerId: string }) {
  const join = useCrewMutation(token, (userId: string) => joinGame({ data: { token, userId } }))
  return (
    <div className="mb-6">
      <p className="mb-3 text-sm text-faint">You are not in this game.</p>
      <button type="button" className="button-primary" disabled={join.isPending} onClick={() => join.mutate(viewerId)}>
        {join.isPending ? 'Joining…' : "I'm playing too"}
      </button>
      {join.isError && <p className="mt-3 text-sm text-seal">{errorMessage(join.error)}</p>}
    </div>
  )
}

function SealForm({ token, roster }: { token: string; roster: ReactNode }) {
  const [draft, setDraft] = useState('')
  const seal = useCrewMutation(token, (list: string) => sealList({ data: { token, list } }))

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        seal.mutate(draft)
      }}
    >
      <textarea
        className="field min-h-72 font-mono text-sm"
        value={draft}
        maxLength={LIST_MAX_LENGTH}
        aria-label="Your army list"
        placeholder="Paste your army list from the Warhammer 40,000 app, New Recruit, or BattleScribe…"
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" className="button-primary" disabled={!draft.trim() || seal.isPending}>
        {seal.isPending ? 'Sealing…' : 'Seal it'}
      </button>
      {seal.isError && <p className="text-sm text-seal">{errorMessage(seal.error)}</p>}
      <p className="text-sm text-faint">Hidden from everyone until the last list is in.</p>
      {roster}
    </form>
  )
}

function Sealed({ token, game, roster }: { token: string; game: GameView; roster: ReactNode }) {
  const [replacing, setReplacing] = useState(false)
  const mine = game.entries.find((entry) => entry.isViewer)
  if (!mine) return null
  if (replacing) return <SealForm token={token} roster={roster} />

  return (
    <section className="space-y-4">
      <div className="panel overflow-hidden">
        <p className="border-b border-edge px-4 py-3 font-display text-sm tracking-[0.14em] text-moss uppercase">Sealed</p>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{mine.list}</pre>
      </div>
      <button type="button" className="button-quiet" onClick={() => setReplacing(true)}>
        Replace
      </button>
      <p className="text-sm text-faint">You can replace it until the last list is in.</p>
      {roster}
    </section>
  )
}

function Roster({ token, game, members }: { token: string; game: GameView; members: CrewMember[] }) {
  const drop = useCrewMutation(token, (userId: string) => dropPlayer({ data: { token, userId } }))
  const join = useCrewMutation(token, (userId: string) => joinGame({ data: { token, userId } }))
  const missing = members.filter((member) => !game.entries.some((entry) => entry.userId === member.userId))

  return (
    <section>
      <h3 className="label">Who is in</h3>
      <ul className="divide-y divide-edge border-y border-edge">
        {game.entries.map((entry) => (
          <RosterRow
            key={entry.userId}
            entry={entry}
            canDrop={game.entries.length > 2}
            dropping={drop.isPending}
            onDrop={() => drop.mutate(entry.userId)}
          />
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-faint">Not playing:</span>
          {missing.map((member) => (
            <button
              key={member.userId}
              type="button"
              className="button-quiet"
              disabled={join.isPending}
              onClick={() => join.mutate(member.userId)}
            >
              Add {member.name}
            </button>
          ))}
        </div>
      )}
      {drop.isError && <p className="mt-3 text-sm text-seal">{errorMessage(drop.error)}</p>}
      {join.isError && <p className="mt-3 text-sm text-seal">{errorMessage(join.error)}</p>}
    </section>
  )
}

function RosterRow({ entry, canDrop, dropping, onDrop }: { entry: EntryView; canDrop: boolean; dropping: boolean; onDrop: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1 truncate">
        {entry.name}
        {entry.isViewer && <span className="ml-2 text-xs tracking-[0.14em] text-faint uppercase">you</span>}
      </span>
      <span className={`font-display text-xs tracking-[0.14em] uppercase ${entry.sealed ? 'text-moss' : 'text-faint'}`}>
        {entry.sealed ? 'sealed' : 'waiting'}
      </span>
      {!entry.sealed && !entry.isViewer && canDrop && (
        <button
          type="button"
          className="button-quiet"
          disabled={dropping}
          onClick={() => {
            if (confirm(`Drop ${entry.name} from this game?`)) onDrop()
          }}
        >
          Drop
        </button>
      )}
    </li>
  )
}

function StartGame({ token, members }: { token: string; members: CrewMember[] }) {
  const [playing, setPlaying] = useState<string[]>(() => members.map((member) => member.userId))
  const start = useCrewMutation(token, (userIds: string[]) => startGame({ data: { token, userIds } }))

  if (members.length < 2) {
    return (
      <section>
        <h2 className="label">Start a game</h2>
        <p className="text-sm text-faint">Send the crew link to someone else first — a game needs two players.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="label">Start a game</h2>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => {
          const selected = playing.includes(member.userId)
          return (
            <button
              key={member.userId}
              type="button"
              aria-pressed={selected}
              className={`button-quiet ${selected ? 'border-brass/60 text-parchment' : 'text-faint'}`}
              onClick={() =>
                setPlaying((current) => (selected ? current.filter((id) => id !== member.userId) : [...current, member.userId]))
              }
            >
              {member.name}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="button-primary mt-4"
        disabled={playing.length < 2 || start.isPending}
        onClick={() => start.mutate(playing)}
      >
        {start.isPending ? 'Starting…' : `Start with ${playing.length}`}
      </button>
      {start.isError && <p className="mt-3 text-sm text-seal">{errorMessage(start.error)}</p>}
    </section>
  )
}

function History({ token, crew }: { token: string; crew: CrewView }) {
  if (crew.pastGames.length === 0) return null
  return (
    <section>
      <h2 className="label">Earlier games</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {crew.pastGames.map((game) => (
          <li key={game.id}>
            <Link to="/c/$token/g/$gameId" params={{ token, gameId: game.id }} className="text-faint underline hover:text-brass">
              Game {game.number}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CrewFooter({ token, crew, viewerId }: { token: string; crew: CrewView; viewerId: string }) {
  const origin = useOrigin()
  const remove = useCrewMutation(token, (userId: string) => removeMember({ data: { token, userId } }))
  const canRemove = canRemoveMember(crew.members.length)

  return (
    <section className="space-y-4 border-t border-edge pt-6">
      <h2 className="label">The crew</h2>
      <ul className="divide-y divide-edge border-y border-edge">
        {crew.members.map((member) => (
          <li key={member.userId} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1 truncate">
              {member.name}
              {member.userId === viewerId && <span className="ml-2 text-xs tracking-[0.14em] text-faint uppercase">you</span>}
            </span>
            {canRemove && (
              <button
                type="button"
                className="button-quiet"
                disabled={remove.isPending}
                onClick={() => {
                  const self = member.userId === viewerId
                  const question = self
                    ? 'Leave this crew? Your lists in finished games stay.'
                    : `Remove ${member.name} from the crew? Their lists in finished games stay.`
                  if (confirm(question)) remove.mutate(member.userId)
                }}
              >
                {member.userId === viewerId ? 'Leave' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {remove.isError && <p className="text-sm text-seal">{errorMessage(remove.error)}</p>}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <CopyButton value={`${origin}/c/${token}`} label="Copy crew link" description="Copy the link to this crew" />
        <p className="text-sm text-faint">Send it once. Everyone signs in and joins.</p>
      </div>
    </section>
  )
}
