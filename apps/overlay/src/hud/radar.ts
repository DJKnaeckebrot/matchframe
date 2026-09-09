import type { GameState, Side, Vector3, WorldGrenadeType } from "@workspace/game-state"
import {
  defaultMapLevel,
  getFacingAngle,
  getMapLevelForZ,
  worldRadiusToRadar,
  worldToRadar,
  type MapLevel,
  type MapMetadata,
  type RadarPoint,
} from "@workspace/maps"

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
  /** False when this marker is on another stacked floor. */
  onLevel: boolean
}

export type RadarBombView = {
  x: number
  y: number
  kind: "carried" | "dropped" | "planted"
  onLevel: boolean
}

export type GrenadePresentationState = "projectile" | "active"

export type RadarGrenadeView = {
  id: string
  type: WorldGrenadeType
  x: number
  y: number
  ownerSteamId?: string
  ownerSide?: Side
  /**
   * Smoke: effectTime > 0 is the cloud. Inferno: any transformed flame point.
   * Everything else stays projectile while the entity exists.
   */
  state: GrenadePresentationState
  /** Normalized radar radius: smoke cloud, or one inferno flame cell. */
  radius?: number
  /** Inferno flame anchors already in radar image space. */
  flamePoints?: readonly RadarPoint[]
  onLevel: boolean
}

export const RADAR_LAYER = {
  smokeArea: 1,
  fireArea: 2,
  projectile: 3,
  bomb: 4,
  player: 5,
  observed: 6,
} as const

/**
 * Ground footprint of a deployed smoke, in world units.
 * GSI does not send radius. CS:GO visblocking is a 144-unit sphere
 * (288 diameter). CS2 volumes fill geometry, but native radar still
 * tracks that choke-scale circle — not a mid-covering blob.
 *
 * Anubis radar span is scale×width = 5.22×1024 ≈ 5345 units, so:
 *   144 → ~2.7% of the image as radius (~22px on the 400px radar)
 *   400 → ~7.5% / ~60px, about 2.8× too wide and ~8× the area.
 */
export const RADAR_SMOKE_PRESENTATION_RADIUS = 144

/**
 * One inferno flame cell, in world units. Not a verified engine radius;
 * overlapping cells should read as occupied ground, not a smoke circle.
 */
export const RADAR_FLAME_PRESENTATION_RADIUS = 90

/**
 * Radar floor for stacked maps. Follows the observed player, then the bomb,
 * then the Valve default (upper) section.
 */
export function getRadarFloor(
  state: GameState,
  metadata: MapMetadata
): MapLevel | undefined {
  const fallback = defaultMapLevel(metadata)
  if (!fallback) {
    return undefined
  }
  const observed = state.observer.playerSteamId
    ? state.players.find((player) => player.steamId === state.observer.playerSteamId)
    : undefined
  const z = observed?.position?.z ?? state.bomb?.position?.z
  if (z === undefined) {
    return fallback
  }
  return getMapLevelForZ(metadata, z) ?? fallback
}

/**
 * Alive players with a world position, already in radar image space.
 * Facing math stays here — not in JSX.
 */
export function getRadarPlayers(
  state: GameState,
  metadata: MapMetadata
): RadarPlayerView[] {
  const observed = state.observer.playerSteamId
  const floor = getRadarFloor(state, metadata)
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
      onLevel: entityOnLevel(player.position.z, floor, metadata),
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
  return {
    x: point.x,
    y: point.y,
    kind,
    onLevel: entityOnLevel(position.z, getRadarFloor(state, metadata), metadata),
  }
}

/**
 * World grenades in radar image space. React must not call worldToRadar.
 * Owner side is resolved from current PlayerState, not stored on the grenade.
 *
 * Smoke `active` is effectTime > 0. Inferno `active` is transformed flame
 * points. Disappearance is the entity leaving `worldGrenades`.
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
    const flamePoints = radarFlamePoints(grenade.flames, metadata)
    const smokeActive = grenade.type === "smoke" && (grenade.effectTime ?? 0) > 0
    const fireActive = flamePoints.length > 0
    const view: RadarGrenadeView = {
      id: grenade.id,
      type: grenade.type,
      x: point.x,
      y: point.y,
      state: smokeActive || fireActive ? "active" : "projectile",
      onLevel: entityOnLevel(grenade.position.z, getRadarFloor(state, metadata), metadata),
    }
    if (grenade.ownerSteamId) {
      view.ownerSteamId = grenade.ownerSteamId
      const owner = state.players.find((player) => player.steamId === grenade.ownerSteamId)
      if (owner) {
        view.ownerSide = owner.side
      }
    }
    if (fireActive) {
      view.flamePoints = flamePoints
      const radius = worldRadiusToRadar(RADAR_FLAME_PRESENTATION_RADIUS, metadata)
      if (radius !== undefined) {
        view.radius = radius
      }
    } else if (smokeActive) {
      const radius = worldRadiusToRadar(RADAR_SMOKE_PRESENTATION_RADIUS, metadata)
      if (radius !== undefined) {
        view.radius = radius
      }
    }
    grenades.push(view)
  }
  return grenades
}

function radarFlamePoints(
  flames: readonly Vector3[] | undefined,
  metadata: MapMetadata
): RadarPoint[] {
  if (!flames?.length) {
    return []
  }
  const points: RadarPoint[] = []
  for (const flame of flames) {
    const point = worldToRadar(flame, metadata)
    if (point) {
      points.push(point)
    }
  }
  return points
}

function entityOnLevel(
  z: number | undefined,
  floor: MapLevel | undefined,
  metadata: MapMetadata
): boolean {
  if (!floor) {
    return true
  }
  if (z === undefined) {
    return true
  }
  return (getMapLevelForZ(metadata, z) ?? defaultMapLevel(metadata))?.id === floor.id
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
