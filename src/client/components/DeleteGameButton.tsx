import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { gameQuery, groupQuery } from '../queries'
import { errorMessage } from '../queryClient'
import { deleteGame } from '../../server/fns'
import { ConfirmButton } from './ConfirmButton'

/** Deletes a game for the whole group, so it asks first and says what goes. */
export function DeleteGameButton({
  token,
  gameId,
  number,
  onDeleted,
}: {
  token: string
  gameId: string
  number: number
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: () => deleteGame({ data: { token, gameId } }),
    onSuccess: (view) => {
      queryClient.setQueryData(groupQuery(token).queryKey, view)
      queryClient.removeQueries({ queryKey: gameQuery(token, gameId).queryKey })
      toast.success(`Game ${number} deleted.`)
      onDeleted?.()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <ConfirmButton
      label={
        <>
          <Trash2 />
          Delete
        </>
      }
      variant="ghost"
      title={`Delete Game ${number}?`}
      description="It goes for everyone, along with every list in it. This cannot be undone."
      confirmLabel="Delete game"
      disabled={remove.isPending}
      onConfirm={() => remove.mutate()}
    />
  )
}
