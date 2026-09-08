import type { CSSProperties } from "react"

export function PackIcon({
  src,
  label,
  decorative,
  className,
}: {
  src: string
  label?: string
  decorative?: boolean
  className: string
}) {
  const named = Boolean(label) && !decorative
  return (
    <span
      role={named ? "img" : undefined}
      aria-label={named ? label : undefined}
      aria-hidden={named ? undefined : true}
      className={`block shrink-0 overflow-hidden bg-current ${className}`}
      style={maskStyle(src)}
    />
  )
}

/** Vector SVG as an image. Sharper than CSS masks for dense grenade art. */
export function PackImage({
  src,
  label,
  decorative,
  className,
}: {
  src: string
  label?: string
  decorative?: boolean
  className: string
}) {
  const named = Boolean(label) && !decorative
  return (
    <img
      src={src}
      alt={named ? label : ""}
      aria-hidden={named ? undefined : true}
      className={`block shrink-0 overflow-hidden object-contain ${className}`}
    />
  )
}

function maskStyle(src: string): CSSProperties {
  const image = `url("${src}")`
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  }
}
