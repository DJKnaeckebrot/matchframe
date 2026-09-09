import type { MapLevel, MapMetadata } from "./types"

/**
 * Valve `verticalsections`: a point is on a floor when
 * `AltitudeMin < z <= AltitudeMax`. No match → undefined.
 */
export function getMapLevelForZ(
  metadata: MapMetadata,
  z: number
): MapLevel | undefined {
  const levels = metadata.levels
  if (!levels?.length || !Number.isFinite(z)) {
    return undefined
  }
  for (const level of levels) {
    if (z > level.altitudeMin && z <= level.altitudeMax) {
      return level
    }
  }
  return undefined
}

export function defaultMapLevel(metadata: MapMetadata): MapLevel | undefined {
  return metadata.levels?.[0]
}
