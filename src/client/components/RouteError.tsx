import { Link } from '@tanstack/react-router'
import { errorMessage } from '../queryClient'

export function RouteError({ error }: { error: unknown }) {
  return (
    <main className="mx-auto mt-[15vh] max-w-md px-6 text-center">
      <h1 className="text-2xl">That did not work</h1>
      <p className="mt-2 text-faint">{errorMessage(error)}</p>
      <p className="mt-6">
        <Link to="/" className="text-brass underline">
          Set up a group
        </Link>
      </p>
    </main>
  )
}
