import type { PlayerState } from "@workspace/game-state"

const ICON_CLASS = "size-3.5 shrink-0"

const LABELS: Record<string, string> = {
  he: "HE",
  flash: "Flash",
  smoke: "Smoke",
  molotov: "Molotov",
  incendiary: "Incendiary",
  decoy: "Decoy",
  bomb: "Bomb",
  defuse: "Kit",
  helmet: "Helmet",
}

export function HudIcon({
  name,
  className = ICON_CLASS,
}: {
  name: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {iconGraphic(name)}
    </svg>
  )
}

export function iconLabel(name: string): string {
  return LABELS[name] ?? name.replace(/_/g, " ")
}

export function UtilityMarks({
  player,
  align,
}: {
  player: PlayerState
  align?: "left" | "right"
}) {
  const marks: { key: string; name: string }[] = []
  for (const grenade of player.equipment.grenades) {
    for (let i = 0; i < grenade.count; i += 1) {
      marks.push({ key: `${grenade.id}-${i}`, name: grenade.id })
    }
  }
  if (player.equipment.hasBomb) {
    marks.push({ key: "bomb", name: "bomb" })
  }
  if (player.equipment.hasDefuseKit) {
    marks.push({ key: "defuse", name: "defuse" })
  }

  if (marks.length === 0) {
    return null
  }

  return (
    <span
      className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}
    >
      {marks.map((mark) => (
        <span
          key={mark.key}
          title={iconLabel(mark.name)}
          className="text-(--mf-text)/80"
        >
          <HudIcon name={mark.name} />
        </span>
      ))}
    </span>
  )
}

function iconGraphic(name: string) {
  switch (name) {
    case "he":
      return <circle cx="6" cy="6" r="3.5" fill="currentColor" />
    case "flash":
      return (
        <>
          <circle cx="6" cy="6" r="2.15" fill="currentColor" />
          <path
            d="M6 0.8v1.8M6 9.4v1.8M0.8 6h1.8M9.4 6h1.8M2.1 2.1l1.3 1.3M8.6 8.6l1.3 1.3M2.1 9.9l1.3-1.3M8.6 3.4l1.3-1.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
          />
        </>
      )
    case "smoke":
      return (
        <>
          <rect x="2" y="7.1" width="8" height="1.9" rx="0.4" fill="currentColor" />
          <rect x="3" y="4.7" width="6" height="1.8" rx="0.4" fill="currentColor" />
          <rect x="4" y="2.4" width="4" height="1.7" rx="0.4" fill="currentColor" />
        </>
      )
    case "molotov":
      return <polygon points="6,1.4 10.5,10.5 1.5,10.5" fill="currentColor" />
    case "incendiary":
      return <polygon points="1.5,1.5 10.5,1.5 6,10.6" fill="currentColor" />
    case "decoy":
      return <polygon points="6,1.3 10.7,6 6,10.7 1.3,6" fill="currentColor" />
    case "bomb":
      return <rect x="1.8" y="3.1" width="8.4" height="5.8" fill="currentColor" />
    case "defuse":
      return (
        <path
          d="M5.1 1.9h1.8v3.1h3.1v1.8H6.9v3.1H5.1V6.8H2v-1.8h3.1z"
          fill="currentColor"
        />
      )
    case "helmet":
      return (
        <path
          d="M2 8.6c0-2.5 1.7-5.1 4-5.1s4 2.6 4 5.1H2z"
          fill="currentColor"
        />
      )
    default:
      return <rect x="2.5" y="5.1" width="7" height="1.8" fill="currentColor" />
  }
}
