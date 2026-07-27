import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { NAME_MAX_LENGTH, PLAYERS_MAX, PLAYERS_MIN, RETENTION_DAYS } from '../core/game'
import { errorMessage } from '../client/queryClient'
import { createGame } from '../server/fns'

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
    mutationFn: (input: { name: string; playerNames: string[] }) => createGame({ data: input }),
    onSuccess: ({ hostToken }) => navigate({ to: '/host/$token', params: { token: hostToken } }),
  })

  const playerNames = seats.map((seat) => seat.name.trim()).filter(Boolean)
  const ready = name.trim().length > 0 && playerNames.length === seats.length

  return (
    <main>
      <h1 className="text-4xl">Lists go in blind</h1>
      <p className="mt-3 mb-9 max-w-lg text-faint">
        Everyone submits hidden. When the last list lands, all of them are revealed at once and locked — nobody reads yours first and builds
        against it.
      </p>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ name: name.trim(), playerNames })
        }}
      >
        <div>
          <label className="label" htmlFor="game-name">
            Game
          </label>
          <input
            id="game-name"
            className="field"
            value={name}
            maxLength={80}
            placeholder="Friday night at Alex's"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <fieldset>
          <legend className="label">Players</legend>
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
                {seats.length > PLAYERS_MIN && (
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
          {seats.length < PLAYERS_MAX && (
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
          {create.isPending ? 'Creating…' : 'Create game'}
        </button>
        {create.isError && <p className="text-sm text-seal">{errorMessage(create.error)}</p>}
      </form>

      <p className="mt-9 text-sm text-faint">
        You get one private link per player to send them. No accounts, and the whole game is deleted {RETENTION_DAYS} days later.
      </p>
    </main>
  )
}
