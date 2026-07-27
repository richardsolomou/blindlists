import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'

import { cn } from '@/lib/utils'

function Separator({ className, orientation = 'horizontal', ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      // Sized off the prop: the generated `data-horizontal:` variants match an
      // attribute Base UI does not emit (it writes `data-orientation`), so the
      // rule never applied and the rule drew nothing.
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch', className)}
      {...props}
    />
  )
}

export { Separator }
