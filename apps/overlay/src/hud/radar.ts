import type { GameState, Side } from "@workspace/game-state"
import { getFacingAngle, worldToRadar, type MapMetadata } from "@workspace/maps"

import { rosterNumber } from "./format"

export type RadarPlayerView = {
  steamId: string
  x: number
  y: number
  angle?: number
  side: Side
  observed: boolean
  /** Team roster number, 1–5. Same index as the player card. */
  slot?: number
}

export type RadarBombView = {
  x: number
  y: number
  kind: "carried" | "dropped" | "planted"
}

/**
 * Alive players with a world position, already in radar image space.
 * Facing math stays here — not in JSX.
 *
 * Next slice: `getRadarGrenades(state, metadata)` once world nades are
 * normalized. Raw GSI `grenades` already survives the merge manager.
 */
export function getRadarPlayers(
  state: GameState,
  metadata: MapMetadata
): RadarPlayerView[] {
  const observed = state.observer.playerSteamId
  const players: RadarPlayerView[] = []
  for (const player of state.players) {
    if (!player.alive || !player.position) {
      continue
    }
    const point = worldToRadar(player.position, metadata)
    if (!point) {
      continue
    }
    const view: RadarPlayerView = {
      steamId: player.steamId,
      x: point.x,
      y: point.y,
      side: player.side,
      observed: player.steamId === observed,
    }
    if (player.forward) {
      const angle = getFacingAngle(player.forward)
      if (angle !== undefined) {
        view.angle = angle
      }
    }
    const slot = rosterNumber(state.players, player.teamId, player.steamId)
    if (slot !== undefined) {
      view.slot = slot
    }
    players.push(view)
  }
  return players
}

export function getRadarBomb(
  state: GameState,
  metadata: MapMetadata
): RadarBombView | null {
  const bomb = state.bomb
  if (!bomb) {
    return null
  }

  const kind = bombKind(bomb.state)
  if (!kind) {
    return null
  }

  const position =
    bomb.position ??
    (kind === "carried" && bomb.carrierSteamId
      ? state.players.find((player) => player.steamId === bomb.carrierSteamId)?.position
      : undefined)
  if (!position) {
    return null
  }

  const point = worldToRadar(position, metadata)
  if (!point) {
    return null
  }
  return { x: point.x, y: point.y, kind }
}

function bombKind(state: string): RadarBombView["kind"] | null {
  if (state === "carried") {
    return "carried"
  }
  if (state === "dropped") {
    return "dropped"
  }
  if (state === "planted" || state === "defusing" || state === "exploding") {
    return "planted"
  }
  return null
}

export function clampRadarCoord(value: number): number {
  return Math.min(1, Math.max(0, value))
}
