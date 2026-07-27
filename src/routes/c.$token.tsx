import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { LIST_MAX_LENGTH, NAME_MAX_LENGTH, shortFingerprint } from '../core/game'
import type { CrewView, EntryView, GameView, MemberRecord } from '../core/game'
import { CopyButton } from '../client/components/CopyButton'
import { GameHeader } from '../client/components/GameHeader'
import { RevealedLists } from '../client/components/RevealedLists'
import { crewQuery } from '../client/queries'
import { errorMessage } from '../client/queryClient'
import { useOrigin } from '../client/useOrigin'
import { addMember, claimMember, dropPlayer, forgetMember, sealList, startGame } from '../server/fns'

export const Route = createFileRoute('/c/$token')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(crewQuery(params.token)),
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

  return (
    <main>
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b border-edge pb-4">
        <h1 className="text-3xl">{crew.name}</h1>
        {crew.viewer && <Identity token={token} viewer={crew.viewer} />}
      </header>

      {crew.viewer ? <CrewBody token={token} crew={crew} /> : <WhoAreYou token={token} members={crew.members} />}
    </main>
  )
}

function Identity({ token, viewer }: { token: string; viewer: MemberRecord }) {
  const forget = useCrewMutation(token, () => forgetMember({ data: { token } }))
  return (
    <p className="text-sm text-faint">
      You are <span className="text-parchment">{viewer.name}</span>{' '}
      <button type="button" className="underline hover:text-brass" onClick={() => forget.mutate(undefined)}>
        not you?
      </button>
    </p>
  )
}

function WhoAreYou({ token, members }: { token: string; members: MemberRecord[] }) {
  const claim = useCrewMutation(token, (memberId: string) => claimMember({ data: { token, memberId } }))
  return (
    <section>
      <h2 className="label">Who are you?</h2>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <button key={member.id} type="button" className="button-quiet" disabled={claim.isPending} onClick={() => claim.mutate(member.id)}>
            {member.name}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-faint">This device will remember you. Nothing to sign up for.</p>
      {claim.isError && <p className="mt-3 text-sm text-seal">{errorMessage(claim.error)}</p>}
    </section>
  )
}

function CrewBody({ token, crew }: { token: string; crew: CrewView }) {
  return (
    <div className="space-y-10">
      {crew.currentGame && <CurrentGame token={token} game={crew.currentGame} />}
      {crew.canStartGame && <StartGame token={token} members={crew.members} />}
      <History token={token} crew={crew} />
      <CrewFooter token={token} />
    </div>
  )
}

function CurrentGame({ token, game }: { token: string; game: GameView }) {
  return (
    <section>
      <GameHeader game={game} />
      {game.status === 'revealed' ? (
        <RevealedLists game={game} />
      ) : game.viewerSealed === null ? (
        <>
          <p className="mb-4 text-sm text-faint">You are sitting this one out.</p>
          <Roster token={token} game={game} />
        </>
      ) : game.viewerSealed ? (
        <Sealed token={token} game={game} />
      ) : (
        <SealForm token={token} game={game} />
      )}
    </section>
  )
}

function SealForm({ token, game }: { token: string; game: GameView }) {
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
      <Roster token={token} game={game} />
    </form>
  )
}

function Sealed({ token, game }: { token: string; game: GameView }) {
  const [replacing, setReplacing] = useState(false)
  const mine = game.entries.find((entry) => entry.isViewer)
  if (!mine) return null
  if (replacing) return <SealForm token={token} game={game} />

  return (
    <section className="space-y-4">
      <div className="panel overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-edge px-4 py-3">
          <span className="font-display text-sm tracking-[0.14em] text-moss uppercase">Sealed</span>
          <span className="font-mono text-xs text-faint" title={mine.listHash ?? undefined}>
            {mine.listHash && shortFingerprint(mine.listHash)}
          </span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">{mine.list}</pre>
      </div>
      <button type="button" className="button-quiet" onClick={() => setReplacing(true)}>
        Replace
      </button>
      <p className="text-sm text-faint">You can replace it until the last list is in.</p>
      <Roster token={token} game={game} />
    </section>
  )
}

function Roster({ token, game }: { token: string; game: GameView }) {
  const drop = useCrewMutation(token, (memberId: string) => dropPlayer({ data: { token, memberId } }))
  return (
    <section>
      <h3 className="label">Who is in</h3>
      <ul className="divide-y divide-edge border-y border-edge">
        {game.entries.map((entry) => (
          <RosterRow
            key={entry.memberId}
            entry={entry}
            canDrop={game.entries.length > 2}
            dropping={drop.isPending}
            onDrop={() => drop.mutate(entry.memberId)}
          />
        ))}
      </ul>
      {drop.isError && <p className="mt-3 text-sm text-seal">{errorMessage(drop.error)}</p>}
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

function StartGame({ token, members }: { token: string; members: MemberRecord[] }) {
  const [playing, setPlaying] = useState<string[]>(() => members.map((member) => member.id))
  const start = useCrewMutation(token, (memberIds: string[]) => startGame({ data: { token, memberIds } }))

  return (
    <section>
      <h2 className="label">Start a game</h2>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => {
          const selected = playing.includes(member.id)
          return (
            <button
              key={member.id}
              type="button"
              aria-pressed={selected}
              className={`button-quiet ${selected ? 'border-brass/60 text-parchment' : 'text-faint'}`}
              onClick={() => setPlaying((current) => (selected ? current.filter((id) => id !== member.id) : [...current, member.id]))}
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

function CrewFooter({ token }: { token: string }) {
  const origin = useOrigin()
  const [name, setName] = useState('')
  const add = useCrewMutation(token, (playerName: string) => addMember({ data: { token, name: playerName } }))

  return (
    <section className="space-y-4 border-t border-edge pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <CopyButton value={`${origin}/c/${token}`} label="Copy crew link" description="Copy the link to this crew" />
        <p className="text-sm text-faint">Send it once. Everyone bookmarks it.</p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          add.mutate(name.trim())
          setName('')
        }}
      >
        <input
          className="field max-w-56"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          aria-label="Add a player to the crew"
          placeholder="Add a player"
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="button-quiet" disabled={!name.trim() || add.isPending}>
          Add
        </button>
      </form>
      {add.isError && <p className="text-sm text-seal">{errorMessage(add.error)}</p>}
    </section>
  )
}
