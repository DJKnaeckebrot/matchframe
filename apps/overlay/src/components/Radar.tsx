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

const RADAR_PX = 288

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
      <div className="relative h-full w-full overflow-hidden bg-(--mf-background)/80 ring-1 ring-(--mf-text)/20">
        <img
          src={asset}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
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
  const color = player.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  return (
    <div
      className="absolute"
      style={{
        left: `${clampRadarCoord(player.x) * 100}%`,
        top: `${clampRadarCoord(player.y) * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {player.observed ? (
        <span
          className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-(--mf-text)/80"
          aria-hidden="true"
        />
      ) : null}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
        style={{
          transform: player.angle === undefined ? undefined : `rotate(${player.angle}deg)`,
        }}
      >
        <polygon points="6,1 10.5,10.5 6,8.2 1.5,10.5" fill={color} />
        <circle cx="6" cy="7.2" r="1.35" fill="var(--mf-text)" />
      </svg>
    </div>
  )
}

function BombMarker({ bomb }: { bomb: RadarBombView }) {
  const planted = bomb.kind === "planted"
  const carried = bomb.kind === "carried"
  const placement = carried
    ? "translate(3px, 5px) scale(0.72)"
    : planted
      ? "translate(-50%, -50%) scale(1.15)"
      : "translate(-50%, -50%)"
  return (
    <div
      className={`absolute ${planted ? "mf-planted-pulse" : carried ? "opacity-80" : ""}`}
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
