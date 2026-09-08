import type { IconSize } from "./icon-types"
import { iconLabel, isCompactHudIcon, resolveHudIcon } from "./icon-registry"
import { PackImage, PackIcon } from "./pack-icon"

const SIZE: Record<IconSize, string> = {
  sm: "h-3.5 w-8",
  md: "h-[18px] w-[46px]",
  lg: "h-8 w-[72px]",
}

export function WeaponIcon({
  weaponId,
  label,
  size = "md",
  decorative,
  className = "",
}: {
  weaponId: string
  label?: string
  size?: IconSize
  decorative?: boolean
  className?: string
}) {
  const src = resolveHudIcon(weaponId)
  const text = label ?? iconLabel(weaponId)
  const slot = `${SIZE[size]} ${className}`
  if (!src) {
    return (
      <span className={`inline-flex shrink-0 items-center text-[11px] tracking-wide uppercase ${slot}`}>
        {text}
      </span>
    )
  }
  const compact = isCompactHudIcon(weaponId)
  const Icon = compact ? PackImage : PackIcon
  return (
    <Icon
      src={src}
      label={text}
      decorative={decorative}
      className={`${slot}${compact ? " object-contain object-center" : ""}`}
    />
  )
}
