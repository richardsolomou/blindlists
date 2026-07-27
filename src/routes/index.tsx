import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { CREW_NAME_MAX_LENGTH } from '../core/game'
import { errorMessage } from '../client/queryClient'
import { meQuery, myCrewsQuery } from '../client/queries'
import { createCrew } from '../server/fns'

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(meQuery()), context.queryClient.ensureQueryData(myCrewsQuery())]),
  component: Home,
})

function Home() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  return (
    <main>
      <h1 className="text-4xl">Warhammer 40,000 lists, sealed until everyone is in</h1>
      <p className="mt-3 mb-9 max-w-lg text-faint">
        Every player pastes their army list hidden. When the last one lands, all of them are revealed at once and locked — nobody reads
        yours first and tailors a detachment to beat it.
      </p>
      {viewer ? <YourCrews /> : <SignedOut />}
    </main>
  )
}

function SignedOut() {
  return (
    <section>
      <Link to="/signin" className="button-primary">
        Sign in to start
      </Link>
      <p className="mt-4 text-sm text-faint">An account keeps your crews and your lists together on every device you use.</p>
    </section>
  )
}

function YourCrews() {
  const { data: crews } = useSuspenseQuery(myCrewsQuery())
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: (crewName: string) => createCrew({ data: { name: crewName } }),
    onSuccess: async ({ token }) => {
      await queryClient.invalidateQueries(myCrewsQuery())
      void navigate({ to: '/c/$token', params: { token } })
    },
  })

  return (
    <div className="space-y-10">
      {crews && crews.length > 0 && (
        <section>
          <h2 className="label">Your crews</h2>
          <ul className="divide-y divide-edge border-y border-edge">
            {crews.map((crew) => (
              <li key={crew.token} className="flex items-center gap-3 py-3">
                <Link to="/c/$token" params={{ token: crew.token }} className="min-w-0 flex-1 truncate hover:text-brass">
                  {crew.name}
                </Link>
                {crew.needsList && <span className="font-display text-xs tracking-[0.14em] text-brass uppercase">list due</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="label">Start a crew</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate(name.trim())
          }}
        >
          <input
            className="field max-w-72"
            value={name}
            maxLength={CREW_NAME_MAX_LENGTH}
            aria-label="Crew name"
            placeholder="Tuesday night at Alex's"
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="button-primary" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        {create.isError && <p className="mt-3 text-sm text-seal">{errorMessage(create.error)}</p>}
        <p className="mt-4 text-sm text-faint">
          You get one link to send your friends. They sign in once and join, and every game from then on is waiting there.
        </p>
      </section>
    </div>
  )
}
