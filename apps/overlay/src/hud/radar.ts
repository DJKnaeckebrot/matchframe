import type { GameState, Side, WorldGrenadeType } from "@workspace/game-state"
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

export type RadarGrenadeView = {
  id: string
  type: WorldGrenadeType
  x: number
  y: number
  ownerSteamId?: string
  ownerSide?: Side
  /** Smoke: effectTime > 0. Other types stay false until their own presentation exists. */
  active: boolean
  /** In-flight facing from GSI velocity XY. Omitted when velocity is missing/zero. */
  angle?: number
}

export const RADAR_LAYER = {
  smokeArea: 1,
  projectile: 2,
  bomb: 2,
  player: 3,
  observed: 4,
} as const

/**
 * Alive players with a world position, already in radar image space.
 * Facing math stays here — not in JSX.
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

/**
 * World grenades in radar image space. React must not call worldToRadar.
 * Owner side is resolved from current PlayerState, not stored on the grenade.
 *
 * Smoke `active` is effectTime > 0 (GSI: 0 / omitted while the projectile is
 * in the air; counting once the cloud exists). Disappearance is the entity
 * leaving `worldGrenades` — there is no fake expired state.
 *
 * Molotov/incendiary later need flame points, not a reused smoke circle.
 */
export function getRadarGrenades(
  state: GameState,
  metadata: MapMetadata
): RadarGrenadeView[] {
  const grenades: RadarGrenadeView[] = []
  for (const grenade of state.worldGrenades ?? []) {
    const point = worldToRadar(grenade.position, metadata)
    if (!point) {
      continue
    }
    const view: RadarGrenadeView = {
      id: grenade.id,
      type: grenade.type,
      x: point.x,
      y: point.y,
      active: grenade.type === "smoke" && (grenade.effectTime ?? 0) > 0,
    }
    if (grenade.ownerSteamId) {
      view.ownerSteamId = grenade.ownerSteamId
      const owner = state.players.find((player) => player.steamId === grenade.ownerSteamId)
      if (owner) {
        view.ownerSide = owner.side
      }
    }
    if (!view.active && grenade.velocity) {
      const angle = getFacingAngle(grenade.velocity)
      if (angle !== undefined) {
        view.angle = angle
      }
    }
    grenades.push(view)
  }
  return grenades
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
