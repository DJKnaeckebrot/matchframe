import { RADAR_LAYER, type RadarGrenadeView } from "../hud/radar"

export function RadarFireArea({ grenade }: { grenade: RadarGrenadeView }) {
  const area = grenade.flameArea
  if (!grenade.onLevel || !area?.length) {
    return null
  }
  const spread = gradientRadius(grenade.x, grenade.y, area)
  const fill = `url(#mf-fire-${grenade.id})`
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ zIndex: RADAR_LAYER.fireArea }}
    >
      <defs>
        <radialGradient
          id={`mf-fire-${grenade.id}`}
          cx={grenade.x}
          cy={grenade.y}
          r={spread}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgb(238 150 58 / 0.48)" />
          <stop offset="46%" stopColor="rgb(196 78 22 / 0.3)" />
          <stop offset="100%" stopColor="rgb(132 38 10 / 0.04)" />
        </radialGradient>
      </defs>
      <polygon
        className="mf-fire-area"
        points={area.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={fill}
      />
    </svg>
  )
}

function gradientRadius(
  x: number,
  y: number,
  area: readonly { x: number; y: number }[]
): number {
  let max = 0
  for (const point of area) {
    const dx = point.x - x
    const dy = point.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > max) {
      max = dist
    }
  }
  return max > 0 ? max : 0.04
}
