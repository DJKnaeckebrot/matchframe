import type { ComponentProps } from "react"
import { cn } from "cn"

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-sm font-medium select-none", className)}
      {...props}
    />
  )
}

export { Label }
