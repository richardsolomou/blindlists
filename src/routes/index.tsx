import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { MEMBERS_MAX, MEMBERS_MIN, NAME_MAX_LENGTH, RETENTION_DAYS } from '../core/game'
import { errorMessage } from '../client/queryClient'
import { createCrew } from '../server/fns'

export const Route = createFileRoute('/')({ component: Home })

type Seat = { key: string; name: string }

function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [seats, setSeats] = useState<Seat[]>([
    { key: 'seat-1', name: '' },
    { key: 'seat-2', name: '' },
  ])
  const nextSeatKey = useRef(seats.length)

  const create = useMutation({
    mutationFn: (input: { name: string; memberNames: string[] }) => createCrew({ data: input }),
    onSuccess: ({ token }) => navigate({ to: '/c/$token', params: { token } }),
  })

  const memberNames = seats.map((seat) => seat.name.trim()).filter(Boolean)
  const ready = name.trim().length > 0 && memberNames.length === seats.length

  return (
    <main>
      <h1 className="text-4xl">Warhammer 40,000 lists, sealed until everyone is in</h1>
      <p className="mt-3 mb-9 max-w-lg text-faint">
        Everyone pastes their army list hidden. When the last one lands, all of them are revealed at once and locked — nobody reads yours
        first and tailors a detachment to beat it.
      </p>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ name: name.trim(), memberNames })
        }}
      >
        <div>
          <label className="label" htmlFor="crew-name">
            Your crew
          </label>
          <input
            id="crew-name"
            className="field"
            value={name}
            maxLength={60}
            placeholder="Tuesday night at Alex's"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <fieldset>
          <legend className="label">Who plays</legend>
          <div className="space-y-2">
            {seats.map((seat, index) => (
              <div key={seat.key} className="flex gap-2">
                <input
                  className="field"
                  value={seat.name}
                  maxLength={NAME_MAX_LENGTH}
                  placeholder={`Player ${index + 1}`}
                  aria-label={`Player ${index + 1}`}
                  onChange={(event) =>
                    setSeats((current) => current.map((entry) => (entry.key === seat.key ? { ...entry, name: event.target.value } : entry)))
                  }
                />
                {seats.length > MEMBERS_MIN && (
                  <button
                    type="button"
                    className="button-quiet"
                    aria-label={`Remove player ${index + 1}`}
                    onClick={() => setSeats((current) => current.filter((entry) => entry.key !== seat.key))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {seats.length < MEMBERS_MAX && (
            <button
              type="button"
              className="button-quiet mt-2"
              onClick={() => {
                nextSeatKey.current += 1
                setSeats((current) => [...current, { key: `seat-${nextSeatKey.current}`, name: '' }])
              }}
            >
              Add player
            </button>
          )}
        </fieldset>

        <button type="submit" className="button-primary" disabled={!ready || create.isPending}>
          {create.isPending ? 'Creating…' : 'Create crew'}
        </button>
        {create.isError && <p className="text-sm text-seal">{errorMessage(create.error)}</p>}
      </form>

      <p className="mt-9 text-sm text-faint">
        You get one link for the whole crew. Send it to them once and every game from then on is waiting there. Games stick around for{' '}
        {RETENTION_DAYS} days.
      </p>
    </main>
  )
}
