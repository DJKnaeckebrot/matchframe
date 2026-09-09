import type { Vector3, WorldGrenadeState, WorldGrenadeType } from "@workspace/game-state"

import { gsiGrenadeSchema, type GsiGrenade, type GsiPayload } from "./schema"
import { parseGsiNumber, parseVector3 } from "./values"

/**
 * Valve world-grenade `type` strings → Matchframe ids.
 * Unknown future values must not fail ingest.
 *
 * Observed on a live Anubis spectator feed:
 * `owner`, `position`, `velocity`, `type`, `lifetime`.
 * Types seen: `smoke`, `flashbang`, `frag`. Smokes send `effecttime`
 * (0 in flight, counting once the cloud exists). Flash/HE omitted it.
 *
 * `firebomb` (projectile) and `inferno` (active fire with `flames`) are
 * documented Valve names. No molotov/incendiary capture is in-repo;
 * mapping below is conservative. Owner side is not encoded into type —
 * presentation picks molotov vs incendiary icon from PlayerState.
 */
export function asWorldGrenadeType(raw: string | undefined): WorldGrenadeType {
  const id = raw?.trim().toLowerCase()
  if (!id) {
    return "unknown"
  }
  if (id === "smoke" || id === "weapon_smokegrenade") {
    return "smoke"
  }
  if (id === "flashbang" || id === "flash" || id === "weapon_flashbang") {
    return "flash"
  }
  if (id === "frag" || id === "he" || id === "hegrenade" || id === "weapon_hegrenade") {
    return "he"
  }
  if (id === "molotov" || id === "weapon_molotov") {
    return "molotov"
  }
  if (id === "incendiary" || id === "incgrenade" || id === "weapon_incgrenade") {
    return "incendiary"
  }
  if (id === "decoy" || id === "weapon_decoy") {
    return "decoy"
  }
  if (id === "firebomb" || id === "inferno") {
    return "molotov"
  }
  return "unknown"
}

export function normalizeWorldGrenades(payload: GsiPayload): WorldGrenadeState[] {
  if (!payload.grenades) {
    return []
  }

  const grenades: WorldGrenadeState[] = []
  for (const [id, raw] of Object.entries(payload.grenades)) {
    const parsed = gsiGrenadeSchema.safeParse(raw)
    if (!parsed.success) {
      continue
    }
    const grenade = normalizeWorldGrenade(id, parsed.data)
    if (grenade) {
      grenades.push(grenade)
    }
  }
  return grenades
}

function normalizeWorldGrenade(id: string, raw: GsiGrenade): WorldGrenadeState | null {
  const position = parseVector3(raw.position)
  if (!position) {
    return null
  }

  const ownerSteamId = raw.owner?.trim() || undefined
  const grenade: WorldGrenadeState = {
    id,
    type: asWorldGrenadeType(raw.type),
    position,
  }
  if (ownerSteamId) {
    grenade.ownerSteamId = ownerSteamId
  }
  const velocity = parseVector3(raw.velocity)
  if (velocity) {
    grenade.velocity = velocity
  }
  const lifetime = parseGsiNumber(raw.lifetime)
  if (lifetime !== undefined) {
    grenade.lifetime = lifetime
  }
  const effectTime = parseGsiNumber(raw.effecttime)
  if (effectTime !== undefined) {
    grenade.effectTime = effectTime
  }
  const flames = parseGrenadeFlames(raw.flames)
  if (flames) {
    grenade.flames = flames
  }
  return grenade
}

/**
 * Inferno `flames` is a map of flame_N → "x, y, z". Skip bad entries;
 * a broken flame must not drop the grenade or the payload.
 */
function parseGrenadeFlames(raw: unknown): readonly Vector3[] | undefined {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return undefined
  }
  const values = Array.isArray(raw) ? raw : Object.values(raw)
  const points: Vector3[] = []
  for (const entry of values) {
    if (typeof entry !== "string") {
      continue
    }
    const point = parseVector3(entry)
    if (point) {
      points.push(point)
    }
  }
  return points.length > 0 ? points : undefined
}
