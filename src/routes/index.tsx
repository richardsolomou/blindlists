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
      {viewer ? (
        <YourCrews />
      ) : (
        <>
          <p className="eyebrow">Warhammer 40,000</p>
          <h1 className="mt-2 text-4xl leading-[1.1]">Nobody sees a list until everybody has sealed one</h1>
          <p className="mt-4 mb-9 max-w-lg text-faint">
            Paste your army list. It stays hidden — from your opponents and from whoever set the game up — until the last one lands. Then
            they all open at once and none of them can change.
          </p>
          <SignedOut />
        </>
      )}
    </main>
  )
}

function SignedOut() {
  return (
    <section>
      <Link to="/signin" className="button-primary">
        Get started
      </Link>
      <p className="mt-4 text-sm text-faint">
        One account, one link to your group, and every game after that is waiting in the same place.
      </p>
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

  const hasCrews = crews !== null && crews.length > 0

  return (
    <div className="space-y-10">
      <section>
        <h2 className="label">Your crews</h2>
        {hasCrews ? (
          <ul className="divide-y divide-edge border-y border-edge">
            {crews.map((crew) => (
              <li key={crew.token} className="flex items-center gap-3">
                <Link
                  to="/c/$token"
                  params={{ token: crew.token }}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3.5 transition-colors hover:text-brass"
                >
                  <span className="min-w-0 flex-1 truncate">{crew.name}</span>
                  {crew.needsList && (
                    <span className="flex items-center gap-2 font-display text-xs tracking-[0.14em] text-brass uppercase">
                      <span className="stamp-revealed" aria-hidden="true" />
                      list due
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">None yet. Start one below, or open the link a friend sent you and join theirs.</p>
        )}
      </section>

      <section className="border-t border-edge pt-8">
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
