import { DE_ANCIENT } from "./maps/de_ancient"
import { DE_ANUBIS } from "./maps/de_anubis"
import { DE_INFERNO } from "./maps/de_inferno"
import { DE_MIRAGE } from "./maps/de_mirage"
import { DE_NUKE } from "./maps/de_nuke"
import { DE_OVERPASS } from "./maps/de_overpass"
import { DE_VERTIGO } from "./maps/de_vertigo"
import type { MapMetadata } from "./types"

const MAPS: Record<string, MapMetadata> = {
  [DE_ANCIENT.id]: DE_ANCIENT,
  [DE_ANUBIS.id]: DE_ANUBIS,
  [DE_INFERNO.id]: DE_INFERNO,
  [DE_MIRAGE.id]: DE_MIRAGE,
  [DE_NUKE.id]: DE_NUKE,
  [DE_OVERPASS.id]: DE_OVERPASS,
  [DE_VERTIGO.id]: DE_VERTIGO,
}

export function mapIdFromName(mapName: string): string {
  const trimmed = mapName.trim().toLowerCase()
  const slash = trimmed.lastIndexOf("/")
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

export function getMapMetadata(mapName: string): MapMetadata | undefined {
  if (!mapName) {
    return undefined
  }
  return MAPS[mapIdFromName(mapName)]
}

export function isRadarSupported(mapName: string): boolean {
  return getMapMetadata(mapName) !== undefined
}

export function mapDisplayName(mapName: string): string {
  const meta = getMapMetadata(mapName)
  if (meta) {
    return meta.displayName
  }
  return mapIdFromName(mapName) || mapName
}
