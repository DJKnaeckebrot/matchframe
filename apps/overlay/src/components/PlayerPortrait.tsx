import type { OverlayPortraitView } from "../portraits/resolve"

export function PlayerPortrait({
  portrait,
  accent,
  className,
}: {
  portrait: OverlayPortraitView
  accent: string
  className?: string
}) {
  const label = portrait.number !== undefined ? `Player ${portrait.number}` : "Player"
  return (
    <span className={`pointer-events-none relative block overflow-hidden ${className ?? "h-full w-full"}`}>
      {portrait.src ? (
        <img
          src={portrait.src}
          alt={label}
          className="absolute inset-0 block h-full w-full max-h-none max-w-none min-h-full min-w-full"
          style={{
            objectFit: portrait.crop.fit,
            objectPosition: portrait.crop.position === "bottom" ? "bottom center" : "center",
          }}
        />
      ) : (
        <span
          className="mf-display flex h-full w-full items-center justify-center text-[22px] font-semibold text-(--mf-text)/70"
          style={{ background: `color-mix(in srgb, ${accent} 18%, var(--mf-background))` }}
          aria-hidden
        >
          {portrait.initials}
        </span>
      )}
    </span>
  )
}
