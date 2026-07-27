import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { GROUP_NAME_MAX_LENGTH } from '../core/game'
import { errorMessage } from '../client/queryClient'
import { meQuery, myGroupsQuery } from '../client/queries'
import { createGroup } from '../server/fns'

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(meQuery()), context.queryClient.ensureQueryData(myGroupsQuery())]),
  component: Home,
})

function Home() {
  const { data: viewer } = useSuspenseQuery(meQuery())
  return viewer ? <YourGroups /> : <Pitch />
}

function Pitch() {
  return (
    <main>
      <p className="eyebrow">Warhammer 40,000</p>
      <h1 className="mt-3 text-4xl leading-[1.1] sm:text-5xl">Swap lists without seeing them first</h1>
      <p className="mt-5 max-w-md text-faint">
        Everyone pastes their list. They stay hidden until the last one is in, then they all open at once and lock.
      </p>
      <div className="mt-8">
        <Link to="/signin" className={cn(buttonVariants({ size: 'lg' }))}>
          Get started
        </Link>
      </div>
      <p className="mt-4 text-sm text-faint">One account, then one link for your group.</p>
    </main>
  )
}

function YourGroups() {
  const { data: groups } = useSuspenseQuery(myGroupsQuery())

  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl">Your groups</h1>
        <NewGroupDialog />
      </div>

      {groups && groups.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {groups.map((group) => (
            <li key={group.token}>
              <Link
                to="/g/$token"
                params={{ token: group.token }}
                className="flex items-center gap-3 rounded-lg border border-edge bg-surface px-4 py-4 transition-colors hover:border-brass/50"
              >
                <span className="min-w-0 flex-1 truncate font-display text-lg">{group.name}</span>
                {group.needsList && (
                  <Badge variant="outline" className="border-brass/50 text-brass">
                    Your list is due
                  </Badge>
                )}
                <ArrowRight className="size-4 shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-edge px-6 py-10 text-center">
          <p className="text-faint">You are not in a group yet.</p>
          <p className="mt-1 text-sm text-faint">Make one, or open the link a friend sent you.</p>
        </div>
      )}
    </main>
  )
}

function NewGroupDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: (groupName: string) => createGroup({ data: { name: groupName } }),
    onSuccess: async ({ token }) => {
      await queryClient.invalidateQueries(myGroupsQuery())
      setOpen(false)
      setName('')
      toast.success('Group created. Send the link to your friends.')
      void navigate({ to: '/g/$token', params: { token } })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus />
            New group
          </Button>
        }
      />
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate(name.trim())
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display">New group</DialogTitle>
            <DialogDescription>Name it after the night you play, or the people in it.</DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={GROUP_NAME_MAX_LENGTH}
              placeholder="Tuesday night at Alex's"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost">Cancel</Button>} />
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
