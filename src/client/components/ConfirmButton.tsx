import { useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/** Anything that cannot be undone asks first, in the app rather than in the browser. */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
  variant = 'outline',
  size = 'sm',
}: {
  label: ReactNode
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  variant?: 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'default'
}) {
  const [open, setOpen] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant={variant} size={size} disabled={disabled}>
            {label}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="ghost">Cancel</Button>} />
          <AlertDialogAction
            render={
              <Button
                variant="destructive"
                onClick={() => {
                  onConfirm()
                  setOpen(false)
                }}
              >
                {confirmLabel}
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
