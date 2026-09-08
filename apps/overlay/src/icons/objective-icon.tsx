import type { IconSize, ObjectiveIconType } from "./icon-types"
import { iconLabel, resolveObjectiveIcon } from "./icon-registry"
import { PackIcon } from "./pack-icon"

const SIZE: Record<IconSize, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
}

export function ObjectiveIcon({
  type,
  size = "sm",
  decorative,
  className = "",
}: {
  type: ObjectiveIconType
  size?: IconSize
  decorative?: boolean
  className?: string
}) {
  const src = resolveObjectiveIcon(type)
  const label = iconLabel(type)
  if (!src) {
    return <span className={`text-[10px] tracking-wide uppercase ${className}`}>{label}</span>
  }
  return (
    <PackIcon
      src={src}
      label={label}
      decorative={decorative}
      className={`${SIZE[size]} ${className}`}
    />
  )
}
