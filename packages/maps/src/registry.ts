import { DE_ANCIENT } from "./maps/de_ancient"
import { DE_ANUBIS } from "./maps/de_anubis"
import type { MapMetadata } from "./types"

const MAPS: Record<string, MapMetadata> = {
  [DE_ANCIENT.id]: DE_ANCIENT,
  [DE_ANUBIS.id]: DE_ANUBIS,
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
