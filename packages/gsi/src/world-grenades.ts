import type { Side, WorldGrenadeState, WorldGrenadeType } from "@workspace/game-state"

import { gsiGrenadeSchema, type GsiGrenade, type GsiPayload } from "./schema"
import { parseGsiNumber, parseVector3 } from "./values"

/**
 * Valve world-grenade `type` strings → Matchframe ids.
 * Unknown future values must not fail ingest.
 *
 * Observed on a live Anubis spectator feed: `owner`, `position`, `velocity`,
 * `type`, `lifetime`; smokes also send `effecttime` (0 in flight, counting
 * once the cloud exists). Flash/HE omitted `effecttime`. Inferno `flames`
 * are parsed but not copied into GameState yet.
 *
 * `firebomb` / `inferno` are both molotov and incendiary; GSI does not name
 * them separately. Owner side is the only reliable split (CT incendiary, T molotov).
 */
export function asWorldGrenadeType(
  raw: string | undefined,
  ownerSide?: Side | null
): WorldGrenadeType {
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
    if (ownerSide === "CT") {
      return "incendiary"
    }
    if (ownerSide === "T") {
      return "molotov"
    }
    return "unknown"
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
    const grenade = normalizeWorldGrenade(id, parsed.data, payload)
    if (grenade) {
      grenades.push(grenade)
    }
  }
  return grenades
}

function normalizeWorldGrenade(
  id: string,
  raw: GsiGrenade,
  payload: GsiPayload
): WorldGrenadeState | null {
  const position = parseVector3(raw.position)
  if (!position) {
    return null
  }

  const ownerSteamId = raw.owner?.trim() || undefined
  const ownerSide = ownerSteamId ? asSide(payload.allplayers?.[ownerSteamId]?.team) : null
  const grenade: WorldGrenadeState = {
    id,
    type: asWorldGrenadeType(raw.type, ownerSide),
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
  return grenade
}

function asSide(value: string | undefined): Side | null {
  if (value === "CT" || value === "T") {
    return value
  }
  return null
}
