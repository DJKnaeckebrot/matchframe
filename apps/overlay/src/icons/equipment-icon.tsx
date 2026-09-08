import type { EquipmentIconType, IconSize } from "./icon-types"
import { iconLabel, resolveEquipmentIcon } from "./icon-registry"
import { PackIcon } from "./pack-icon"

const SIZE: Record<IconSize, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
}

export function EquipmentIcon({
  type,
  size = "sm",
  decorative,
  className = "",
}: {
  type: EquipmentIconType
  size?: IconSize
  decorative?: boolean
  className?: string
}) {
  const src = resolveEquipmentIcon(type)
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
