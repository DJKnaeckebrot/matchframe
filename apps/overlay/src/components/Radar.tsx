import type { GameState } from "@workspace/game-state"
import { getMapMetadata, type MapMetadata } from "@workspace/maps"

import { getRadarAsset } from "../assets/radar/pack"
import { SHOW_DIAGNOSTICS } from "../hud/diagnostics"
import {
  clampRadarCoord,
  getRadarBomb,
  getRadarGrenades,
  getRadarPlayers,
  RADAR_LAYER,
  type RadarBombView,
  type RadarGrenadeView,
  type RadarPlayerView,
} from "../hud/radar"
import { useRadarMotion } from "../hud/radar-motion"
import { iconLabel, ObjectiveIcon, resolveUtilityIcon } from "../icons"
import { PackImage } from "../icons/pack-icon"

const RADAR_PX = 400

export function Radar({ state }: { state: GameState }) {
  const metadata = getMapMetadata(state.map.name)
  const asset = metadata ? getRadarAsset(metadata.id) : undefined
  if (!metadata || !asset) {
    return SHOW_DIAGNOSTICS && state.map.name ? (
      <p className="absolute top-8 left-8 text-[10px] tracking-[0.16em] text-(--mf-text-muted) uppercase">
        Radar hidden · {state.map.name}
      </p>
    ) : null
  }

  return <RadarMap state={state} metadata={metadata} asset={asset} />
}

function RadarMap({
  state,
  metadata,
  asset,
}: {
  state: GameState
  metadata: MapMetadata
  asset: string
}) {
  const { players, bomb, grenades } = useRadarMotion(
    getRadarPlayers(state, metadata),
    getRadarBomb(state, metadata),
    getRadarGrenades(state, metadata)
  )

  return (
    <div
      className="absolute top-8 left-8"
      style={{ width: RADAR_PX, height: RADAR_PX }}
    >
      <div className="relative h-full w-full">
        <img
          src={asset}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {grenades.map((grenade) => (
          <RadarGrenade key={grenade.id} grenade={grenade} />
        ))}
        {bomb ? <BombMarker bomb={bomb} /> : null}
        {players.map((player) => (
          <PlayerMarker key={player.steamId} player={player} />
        ))}
      </div>
    </div>
  )
}

function radarTranslate(x: number, y: number): string {
  return `translate3d(${clampRadarCoord(x) * RADAR_PX}px, ${clampRadarCoord(y) * RADAR_PX}px, 0)`
}

function RadarGrenade({ grenade }: { grenade: RadarGrenadeView }) {
  if (grenade.flamePoints && grenade.flamePoints.length > 0) {
    return <FireRadarEffect grenade={grenade} />
  }
  if (grenade.type === "smoke" && grenade.state === "active") {
    return <SmokeRadarEffect grenade={grenade} />
  }
  if (grenade.type === "decoy") {
    return <DecoyRadarMarker grenade={grenade} />
  }
  if (
    grenade.type === "he" ||
    grenade.type === "flash" ||
    grenade.type === "smoke" ||
    grenade.type === "molotov" ||
    grenade.type === "incendiary"
  ) {
    return <GrenadeProjectileMarker grenade={grenade} />
  }
  return null
}

function PlayerMarker({ player }: { player: RadarPlayerView }) {
  const fill = player.observed
    ? "var(--mf-text)"
    : player.side === "CT"
      ? "var(--mf-ct)"
      : "var(--mf-t)"
  const ink = player.observed ? "#111418" : "var(--mf-text)"

  return (
    <div
      className="absolute size-9"
      style={{
        left: 0,
        top: 0,
        transform: `${radarTranslate(player.x, player.y)} translate(-50%, -50%)`,
        zIndex: player.observed ? RADAR_LAYER.observed : RADAR_LAYER.player,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          color: fill,
          filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.9))",
          transform: player.angle === undefined ? undefined : `rotate(${player.angle}deg)`,
        }}
      >
        <g
          fill="currentColor"
          stroke="#0b0d10"
          strokeWidth="2.4"
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          <polygon points="16,1.6 22.4,12 9.6,12" />
          <circle cx="16" cy="17.4" r="9.6" />
        </g>
      </svg>
      <span
        className="mf-display absolute top-[19px] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none font-bold tabular-nums"
        style={{
          color: ink,
          textShadow: player.observed
            ? "none"
            : "0 1px 1px rgb(0 0 0 / 0.85)",
        }}
      >
        {player.slot ?? ""}
      </span>
    </div>
  )
}

function BombMarker({ bomb }: { bomb: RadarBombView }) {
  const planted = bomb.kind === "planted"
  const carried = bomb.kind === "carried"
  const placement = carried
    ? "translate(10px, 2px) scale(0.78)"
    : "translate(-50%, -50%)"
  return (
    <div
      className={`absolute ${carried ? "opacity-90" : ""}`}
      style={{
        left: 0,
        top: 0,
        zIndex: RADAR_LAYER.bomb,
        transform: `${radarTranslate(bomb.x, bomb.y)} ${placement}`,
      }}
    >
      <div className="relative flex size-8 items-center justify-center">
        {planted ? (
          <span className="mf-radar-bomb-halo absolute inset-[-6px] rounded-full" aria-hidden="true" />
        ) : null}
        <span
          className="relative flex size-7 items-center justify-center rounded-full"
          style={{
            background: "rgb(11 13 16 / 0.82)",
            boxShadow: "0 0 0 1.5px rgb(8 10 12 / 0.95), 0 2px 5px rgb(0 0 0 / 0.7)",
          }}
        >
          <ObjectiveIcon type="bomb" decorative />
        </span>
      </div>
    </div>
  )
}

function SmokeRadarEffect({ grenade }: { grenade: RadarGrenadeView }) {
  const radius = grenade.radius
  if (radius === undefined || radius <= 0) {
    return null
  }
  const size = radius * 2 * RADAR_PX
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 0,
        top: 0,
        zIndex: RADAR_LAYER.smokeArea,
        width: size,
        height: size,
        transform: `${radarTranslate(grenade.x, grenade.y)} translate(-50%, -50%)`,
      }}
    >
      <div className="mf-smoke-area relative h-full w-full">
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80">
          <GrenadeIcon id="smoke" className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )
}

function FireRadarEffect({ grenade }: { grenade: RadarGrenadeView }) {
  const points = grenade.flamePoints
  const radius = grenade.radius
  if (!points?.length || radius === undefined || radius <= 0) {
    return null
  }
  const size = radius * 2 * RADAR_PX
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: RADAR_LAYER.fireArea }}>
      {points.map((point, index) => (
        <div
          key={`${grenade.id}-${index}`}
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: size,
            height: size,
            transform: `${radarTranslate(point.x, point.y)} translate(-50%, -50%)`,
          }}
        >
          <div className="mf-fire-cell h-full w-full" />
        </div>
      ))}
    </div>
  )
}

function DecoyRadarMarker({ grenade }: { grenade: RadarGrenadeView }) {
  return <GrenadeProjectileMarker grenade={grenade} />
}

function GrenadeProjectileMarker({ grenade }: { grenade: RadarGrenadeView }) {
  const tint =
    grenade.ownerSide === "CT"
      ? "var(--mf-ct)"
      : grenade.ownerSide === "T"
        ? "var(--mf-t)"
        : "rgb(231 235 240 / 0.55)"

  return (
    <div
      className="pointer-events-none absolute size-4"
      style={{
        left: 0,
        top: 0,
        zIndex: RADAR_LAYER.projectile,
        transform: `${radarTranslate(grenade.x, grenade.y)} translate(-50%, -50%)`,
        filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.75))",
      }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: "rgb(11 13 16 / 0.62)",
          boxShadow: `0 0 0 1px ${tint}`,
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <GrenadeIcon id={projectileIconId(grenade)} className="h-2.5 w-2.5" />
      </span>
    </div>
  )
}

function projectileIconId(grenade: RadarGrenadeView): string {
  if (grenade.type === "molotov" || grenade.type === "incendiary") {
    if (grenade.ownerSide === "CT") {
      return "incendiary"
    }
    if (grenade.ownerSide === "T") {
      return "molotov"
    }
  }
  return grenade.type
}

function GrenadeIcon({ id, className }: { id: string; className: string }) {
  const src = resolveUtilityIcon(id)
  if (!src) {
    return <span className={`text-[8px] tracking-wide uppercase ${className}`}>{id.slice(0, 3)}</span>
  }
  return <PackImage src={src} label={iconLabel(id)} decorative className={className} />
}
