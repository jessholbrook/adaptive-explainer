import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/* Material Design 3 — outlined text field.
 * 56px height, 1.5px outline that thickens to 2px on focus,
 * outline color shifts to primary on focus.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-14 w-full min-w-0 rounded-[8px] border-[1.5px] border-input bg-transparent px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground focus-visible:border-primary focus-visible:border-2 focus-visible:px-[15px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
