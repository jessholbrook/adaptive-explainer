import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Material Design 3 buttons:
 * - Pill (rounded-full) shape
 * - State-layer hover/active overlays via /8 and /12 opacity
 * - Filled = elevation-1 lift; tonal/outlined = no shadow
 * - Heights: 40px default, MD3 spec
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        // Filled — primary action, elevation-1
        default:
          "bg-primary text-primary-foreground shadow-[var(--md-elev-1)] hover:shadow-[var(--md-elev-2)] hover:bg-primary/92 active:bg-primary/88",
        // Outlined — secondary actions
        outline:
          "border-input bg-transparent text-primary hover:bg-primary/8 active:bg-primary/12",
        // Filled tonal — uses secondary container
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/88 active:bg-secondary/80",
        // Text button
        ghost:
          "text-primary hover:bg-primary/8 active:bg-primary/12",
        // Destructive (filled tonal, error tint)
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/20",
        // Link
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-10 px-6 has-data-[icon=inline-start]:pl-4 has-data-[icon=inline-end]:pr-4",
        xs: "h-7 px-3 text-xs gap-1 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 px-4 text-[0.8rem] gap-1.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-7 text-[0.95rem] has-data-[icon=inline-start]:pl-5 has-data-[icon=inline-end]:pr-5",
        icon: "size-10 px-0",
        "icon-xs": "size-7 px-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 px-0",
        "icon-lg": "size-12 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
