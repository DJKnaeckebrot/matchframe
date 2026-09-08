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
  const smokes = grenades.filter((grenade) => grenade.type === "smoke")
  const areas = smokes.filter((grenade) => grenade.active)
  const flying = smokes.filter((grenade) => !grenade.active)

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
        {areas.map((grenade) => (
          <SmokeArea key={grenade.id} grenade={grenade} />
        ))}
        {bomb ? <BombMarker bomb={bomb} /> : null}
        {flying.map((grenade) => (
          <SmokeProjectile key={grenade.id} grenade={grenade} />
        ))}
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

function SmokeArea({ grenade }: { grenade: RadarGrenadeView }) {
  return (
    <div
      className="pointer-events-none absolute overflow-visible"
      style={{
        left: 0,
        top: 0,
        zIndex: RADAR_LAYER.smokeArea,
        transform: `${radarTranslate(grenade.x, grenade.y)} translate(-16px, -16px)`,
        filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.85))",
      }}
    >
      <svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true">
        <circle cx="16" cy="16" r="11.2" fill="#9aa3ab" />
        <circle cx="16" cy="16" r="11.2" fill="none" stroke="#f3f6f8" strokeWidth="1.5" />
        <line
          x1="16"
          y1="27.4"
          x2="16"
          y2="37"
          stroke="#f3f6f8"
          strokeWidth="1.15"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
    </div>
  )
}

function SmokeProjectile({ grenade }: { grenade: RadarGrenadeView }) {
  const tint =
    grenade.ownerSide === "CT"
      ? "var(--mf-ct)"
      : grenade.ownerSide === "T"
        ? "var(--mf-t)"
        : "var(--mf-text)"

  return (
    <div
      className="pointer-events-none absolute size-5"
      style={{
        left: 0,
        top: 0,
        zIndex: RADAR_LAYER.projectile,
        transform: `${radarTranslate(grenade.x, grenade.y)} translate(-50%, -50%)`,
        filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.7))",
      }}
    >
      {grenade.angle !== undefined ? (
        <svg
          viewBox="0 0 20 20"
          className="absolute inset-0"
          aria-hidden="true"
          style={{ color: tint, transform: `rotate(${grenade.angle}deg)` }}
        >
          <polygon points="10,1 13,6.5 7,6.5" fill="currentColor" opacity="0.85" />
        </svg>
      ) : null}
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <SmokeIcon className="h-3.5 w-3.5" />
      </span>
    </div>
  )
}

function SmokeIcon({ className }: { className: string }) {
  const src = resolveUtilityIcon("smoke")
  if (!src) {
    return <span className={`text-[8px] tracking-wide uppercase ${className}`}>SMK</span>
  }
  return <PackImage src={src} label={iconLabel("smoke")} decorative className={className} />
}
