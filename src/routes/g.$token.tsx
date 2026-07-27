import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { Check, Copy, Plus, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LIST_MAX_LENGTH, PLAYERS_MIN, canRemoveMember } from '../core/game'
import type { EntryView, GameView, GroupMember, GroupView } from '../core/game'
import { ConfirmButton } from '../client/components/ConfirmButton'
import { DeleteGameButton } from '../client/components/DeleteGameButton'
import { RevealedLists } from '../client/components/RevealedLists'
import { groupQuery, meQuery } from '../client/queries'
import { errorMessage } from '../client/queryClient'
import { useLiveGroup } from '../client/useLiveGroup'
import { useOrigin } from '../client/useOrigin'
import { dropPlayer, joinGame, joinGroup, removeMember, sealList, startGame } from '../server/fns'

export const Route = createFileRoute('/g/$token')({
  loader: async ({ context, params }) => {
    const [group] = await Promise.all([
      context.queryClient.ensureQueryData(groupQuery(params.token)),
      context.queryClient.ensureQueryData(meQuery()),
    ])
    if (group === null) throw notFound()
  },
  component: GroupPage,
})

/** Every mutation returns the whole group view, so the page just swaps its state. */
function useGroupMutation<TInput>(token: string, call: (input: TInput) => Promise<GroupView>, done?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: (view) => {
      queryClient.setQueryData(groupQuery(token).queryKey, view)
      if (done) toast.success(done)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

function GroupPage() {
  const { token } = Route.useParams()
  const { data: group } = useSuspenseQuery(groupQuery(token))
  const { data: viewer } = useSuspenseQuery(meQuery())
  const isMember = typeof group === 'object' && group !== null && group.isMember
  useLiveGroup(token, isMember)

  if (group === 'signed-out' || !viewer) return <SignInFirst token={token} />
  if (!group) throw notFound()

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{group.name}</h1>
          <p className="mt-1.5 text-sm text-faint">{group.members.map((member) => member.name).join(', ')}</p>
        </div>
        {group.isMember && (
          <div className="flex flex-wrap items-center gap-2">
            <PlayersDialog token={token} group={group} viewerId={viewer.id} />
            {/* Only ever offered once the last lot is open, so it can never read as an action on the game on screen. */}
            {group.canStartGame && group.currentGame && <NewGameDialog token={token} members={group.members} />}
          </div>
        )}
      </div>
      <Separator className="my-7" />
      {group.isMember ? (
        <div className="space-y-8">
          {group.currentGame ? (
            <CurrentGame token={token} game={group.currentGame} members={group.members} viewerId={viewer.id} />
          ) : (
            <NoGames token={token} group={group} />
          )}
          <History token={token} group={group} />
        </div>
      ) : (
        <JoinGroup token={token} group={group} />
      )}
    </main>
  )
}

function SignInFirst({ token }: { token: string }) {
  return (
    <main className="max-w-md">
      <p className="eyebrow">You have been invited</p>
      <h1 className="mt-3 text-3xl">Someone wants you in their group</h1>
      <p className="mt-4 mb-7 text-faint">Sign in and you can join. Your lists stay with your account, on whatever device you use.</p>
      <Link to="/signin" search={{ next: `/g/${token}` }} className={cn(buttonVariants({ size: 'lg' }))}>
        Sign in
      </Link>
    </main>
  )
}

function JoinGroup({ token, group }: { token: string; group: GroupView }) {
  const join = useGroupMutation(token, () => joinGroup({ data: { token } }), 'You are in.')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Join this group</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-faint">
          {group.members.length === 0
            ? 'Nobody has joined yet. You would be first.'
            : `Already here: ${group.members.map((member) => member.name).join(', ')}.`}
        </p>
        <Button disabled={join.isPending} onClick={() => join.mutate(undefined)}>
          {join.isPending ? 'Joining…' : 'Join group'}
        </Button>
      </CardContent>
    </Card>
  )
}

/** A group with nothing in it yet: say what this place is for, then offer the one thing to do. */
function NoGames({ token, group }: { token: string; group: GroupView }) {
  const enoughPlayers = group.members.length >= PLAYERS_MIN

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">No games yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="max-w-prose text-sm text-faint">
          Make a game when you are about to play. Everyone in it pastes the list they are bringing, and nobody sees anyone else&rsquo;s
          until the last one is in — then they all open at once and lock.
        </p>
        {enoughPlayers ? (
          <NewGameDialog token={token} members={group.members} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <CopyInviteButton token={token} />
            <p className="text-sm text-faint">It takes two of you.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CurrentGame({ token, game, members, viewerId }: { token: string; game: GameView; members: GroupMember[]; viewerId: string }) {
  const revealed = game.status === 'revealed'
  const roster = <Roster token={token} game={game} members={members} />

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Game {game.number}</h2>
        <div className="flex items-center gap-2">
          {revealed ? (
            <Badge className="gap-2 border-brass/50 bg-brass/10 text-brass" variant="outline">
              <span className="stamp-revealed" aria-hidden="true" />
              All lists open
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2">
              <span className="stamp-waiting" aria-hidden="true" />
              {game.sealed} of {game.total} sealed
            </Badge>
          )}
          <DeleteGameButton token={token} gameId={game.id} number={game.number} />
        </div>
      </div>

      {revealed ? (
        <RevealedLists game={game} />
      ) : game.viewerSealed === null ? (
        <div className="space-y-6">
          <SittingOut token={token} viewerId={viewerId} />
          {roster}
        </div>
      ) : game.viewerSealed ? (
        <Sealed token={token} game={game} roster={roster} />
      ) : (
        <SealForm token={token} roster={roster} />
      )}
    </section>
  )
}

function SittingOut({ token, viewerId }: { token: string; viewerId: string }) {
  const join = useGroupMutation(token, (userId: string) => joinGame({ data: { token, userId } }), 'You are in.')
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-faint">You are sitting this one out.</p>
        <Button disabled={join.isPending} onClick={() => join.mutate(viewerId)}>
          {join.isPending ? 'Adding…' : 'Add me'}
        </Button>
      </CardContent>
    </Card>
  )
}

function SealForm({ token, roster }: { token: string; roster: ReactNode }) {
  const [draft, setDraft] = useState('')
  const seal = useGroupMutation(token, (list: string) => sealList({ data: { token, list } }), 'Sealed.')

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              seal.mutate(draft)
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="list">Your list</Label>
              <Textarea
                id="list"
                className="min-h-64 font-mono text-sm"
                value={draft}
                maxLength={LIST_MAX_LENGTH}
                placeholder="Paste it from the Warhammer 40,000 app, New Recruit, BattleScribe, anywhere."
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={!draft.trim() || seal.isPending}>
                {seal.isPending ? 'Sealing…' : 'Seal list'}
              </Button>
              <p className="text-sm text-faint">Nobody can read it until everyone is in.</p>
            </div>
          </form>
        </CardContent>
      </Card>
      {roster}
    </div>
  )
}

function Sealed({ token, game, roster }: { token: string; game: GameView; roster: ReactNode }) {
  const [replacing, setReplacing] = useState(false)
  const mine = game.entries.find((entry) => entry.isViewer)
  if (!mine) return null
  if (replacing) return <SealForm token={token} roster={roster} />

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 font-display text-lg text-moss">
            <span className="stamp-sealed" aria-hidden="true" />
            Sealed
          </CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
              Replace
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">{mine.list}</pre>
        </CardContent>
      </Card>
      <p className="text-sm text-faint">You can swap it out until the last list is in.</p>
      {roster}
    </div>
  )
}

function Roster({ token, game, members }: { token: string; game: GameView; members: GroupMember[] }) {
  const drop = useGroupMutation(token, (userId: string) => dropPlayer({ data: { token, userId } }), 'Dropped.')
  const join = useGroupMutation(token, (userId: string) => joinGame({ data: { token, userId } }), 'Added.')
  const missing = members.filter((member) => !game.entries.some((entry) => entry.userId === member.userId))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Playing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {game.entries.map((entry) => (
          <RosterRow
            key={entry.userId}
            entry={entry}
            canDrop={game.entries.length > 2}
            dropping={drop.isPending}
            onDrop={() => drop.mutate(entry.userId)}
          />
        ))}
        {missing.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <span className="text-sm text-faint">Sitting out:</span>
            {missing.map((member) => (
              <Button
                key={member.userId}
                variant="outline"
                size="sm"
                className="normal-case"
                disabled={join.isPending}
                onClick={() => join.mutate(member.userId)}
              >
                <Plus />
                {member.name}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RosterRow({ entry, canDrop, dropping, onDrop }: { entry: EntryView; canDrop: boolean; dropping: boolean; onDrop: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Initials name={entry.name} />
      <span className="min-w-0 flex-1 truncate">
        {entry.name}
        {entry.isViewer && <span className="ml-2 text-xs tracking-[0.14em] text-faint uppercase">you</span>}
      </span>
      {entry.sealed ? (
        <span className="flex items-center gap-2 text-sm text-moss">
          <Check className="size-3.5" />
          Sealed
        </span>
      ) : (
        <span className="text-sm text-faint">Waiting</span>
      )}
      {!entry.sealed && !entry.isViewer && canDrop && (
        <ConfirmButton
          label="Drop"
          variant="ghost"
          title={`Drop ${entry.name}?`}
          description="They come out of this game. You can add them back while it is still open."
          confirmLabel="Drop them"
          disabled={dropping}
          onConfirm={onDrop}
        />
      )}
    </div>
  )
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full border border-edge bg-raised font-display text-xs text-faint"
    >
      {initials}
    </span>
  )
}

/**
 * Opens the next game and asks the players in it for a list. The dialog carries
 * the explanation: the app collects lists, it does not run anything you play.
 */
function NewGameDialog({ token, members }: { token: string; members: GroupMember[] }) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState<string[]>(() => members.map((member) => member.userId))
  const start = useGroupMutation(token, (userIds: string[]) => startGame({ data: { token, userIds } }), 'Everyone can paste a list now.')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Opening starts from everyone, so anyone who joined since last time is in.
        if (next) setPlaying(members.map((member) => member.userId))
        setOpen(next)
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            New game
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New game</DialogTitle>
          <DialogDescription>
            Everyone you pick pastes a list. They stay hidden until the last one is in, then they all open at once and lock.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="my-5">
          <legend className="mb-3 text-sm text-faint">Who is playing?</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const selected = playing.includes(member.userId)
              return (
                <Button
                  key={member.userId}
                  variant={selected ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={selected}
                  className={cn('normal-case', selected ? 'border-brass/50' : 'text-faint')}
                  onClick={() =>
                    setPlaying((current) => (selected ? current.filter((id) => id !== member.userId) : [...current, member.userId]))
                  }
                >
                  {selected && <Check />}
                  {member.name}
                </Button>
              )
            })}
          </div>
        </fieldset>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button
            disabled={playing.length < PLAYERS_MIN || start.isPending}
            onClick={() => start.mutate(playing, { onSuccess: () => setOpen(false) })}
          >
            {start.isPending ? 'Creating…' : 'Create game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyInviteButton({ token }: { token: string }) {
  const origin = useOrigin()
  return (
    <Button
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(`${origin}/g/${token}`).then(() => toast.success('Invite link copied.'))
      }}
    >
      <Copy />
      Copy invite link
    </Button>
  )
}

function History({ token, group }: { token: string; group: GroupView }) {
  if (group.pastGames.length === 0) return null
  return (
    <section>
      <h2 className="eyebrow mb-3">Finished games</h2>
      <div className="flex flex-wrap gap-2">
        {group.pastGames.map((game) => (
          <Link
            key={game.id}
            to="/g/$token/game/$gameId"
            params={{ token, gameId: game.id }}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Game {game.number}
          </Link>
        ))}
      </div>
    </section>
  )
}

function PlayersDialog({ token, group, viewerId }: { token: string; group: GroupView; viewerId: string }) {
  const remove = useGroupMutation(token, (userId: string) => removeMember({ data: { token, userId } }))
  const canRemove = canRemoveMember(group.members.length)

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Users />
            {group.members.length} {group.members.length === 1 ? 'player' : 'players'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Players</DialogTitle>
          <DialogDescription>Anyone with the link can join. Removing someone leaves their finished games alone.</DialogDescription>
        </DialogHeader>
        <div className="my-2 space-y-1">
          {group.members.map((member) => {
            const isViewer = member.userId === viewerId
            return (
              <div key={member.userId} className="flex items-center gap-3 py-2">
                <Initials name={member.name} />
                <span className="min-w-0 flex-1 truncate">
                  {member.name}
                  {isViewer && <span className="ml-2 text-xs tracking-[0.14em] text-faint uppercase">you</span>}
                </span>
                {canRemove && (
                  <ConfirmButton
                    label={isViewer ? 'Leave' : 'Remove'}
                    variant="ghost"
                    title={isViewer ? 'Leave this group?' : `Remove ${member.name}?`}
                    description={
                      isViewer
                        ? 'You come off the list of players. Anything you sealed in a finished game stays there.'
                        : 'They come off the list of players. Anything they sealed in a finished game stays there.'
                    }
                    confirmLabel={isViewer ? 'Leave' : 'Remove'}
                    disabled={remove.isPending}
                    onConfirm={() => remove.mutate(member.userId)}
                  />
                )}
              </div>
            )
          })}
        </div>
        <DialogFooter className="sm:justify-start">
          <CopyInviteButton token={token} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
