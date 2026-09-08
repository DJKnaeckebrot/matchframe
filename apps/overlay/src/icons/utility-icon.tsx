import type { IconSize } from "./icon-types"
import { iconLabel, resolveUtilityIcon, utilityCountBadge } from "./icon-registry"
import { PackImage } from "./pack-icon"

const SIZE: Record<IconSize, string> = {
  sm: "h-[18px] w-[18px] object-bottom",
  md: "h-5 w-5 object-bottom",
  lg: "h-6 w-6 object-bottom",
}

export function UtilityIcon({
  utilityId,
  count = 1,
  size = "sm",
  className = "",
}: {
  utilityId: string
  count?: number
  size?: IconSize
  className?: string
}) {
  if (count <= 0) {
    return null
  }
  const src = resolveUtilityIcon(utilityId)
  const name = iconLabel(utilityId)
  const badge = utilityCountBadge(count)
  const label = badge ? `${name} ×${badge}` : name

  return (
    <span className={`flex items-center gap-0.5 ${className}`}>
      {src ? (
        <PackImage src={src} label={label} className={SIZE[size]} />
      ) : (
        <span className="text-[10px] tracking-wide uppercase">{name}</span>
      )}
      {badge ? (
        <span className="text-[10px] leading-none tabular-nums">{badge}</span>
      ) : null}
    </span>
  )
}
