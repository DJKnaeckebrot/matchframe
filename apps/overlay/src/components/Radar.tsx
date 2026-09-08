import type { GameState } from "@workspace/game-state"
import { getMapMetadata } from "@workspace/maps"

import { getRadarAsset } from "../assets/radar/pack"
import { SHOW_DIAGNOSTICS } from "../hud/diagnostics"
import {
  clampRadarCoord,
  getRadarBomb,
  getRadarPlayers,
  type RadarBombView,
  type RadarPlayerView,
} from "../hud/radar"
import { ObjectiveIcon } from "../icons"

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

  const players = getRadarPlayers(state, metadata)
  const bomb = getRadarBomb(state, metadata)

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
        {players.map((player) => (
          <PlayerMarker key={player.steamId} player={player} />
        ))}
        {bomb ? <BombMarker bomb={bomb} /> : null}
      </div>
    </div>
  )
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
      className="absolute size-8"
      style={{
        left: `${clampRadarCoord(player.x) * 100}%`,
        top: `${clampRadarCoord(player.y) * 100}%`,
        transform: "translate(-50%, -50%)",
        zIndex: player.observed ? 3 : 1,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          color: fill,
          filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.7))",
          transform: player.angle === undefined ? undefined : `rotate(${player.angle}deg)`,
        }}
      >
        <polygon points="16,1 22,11.4 10,11.4" fill="currentColor" />
        <circle cx="16" cy="17" r="10" fill="currentColor" />
      </svg>
      <span
        className="absolute top-[17px] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] leading-none font-bold tabular-nums"
        style={{ color: ink }}
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
    ? "translate(8px, 1px) scale(0.7)"
    : planted
      ? "translate(-50%, -50%) scale(1.05)"
      : "translate(-50%, -50%)"
  return (
    <div
      className={`absolute ${planted ? "mf-planted-pulse" : carried ? "opacity-85" : ""}`}
      style={{
        left: `${clampRadarCoord(bomb.x) * 100}%`,
        top: `${clampRadarCoord(bomb.y) * 100}%`,
        transform: placement,
      }}
    >
      <ObjectiveIcon type="bomb" decorative />
    </div>
  )
}
