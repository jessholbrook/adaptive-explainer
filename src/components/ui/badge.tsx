import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* MD3 assist chip — 32px tall, 8px radius, 1px outline-variant for outline variant. */
const badgeVariants = cva(
  "group/badge inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-transparent px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-4!",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/88",
        secondary:
          "bg-muted text-foreground [a]:hover:bg-muted/80",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/15",
        outline:
          "border-border bg-transparent text-foreground [a]:hover:bg-muted",
        ghost:
          "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
