import anubisRadar from "./de_anubis_radar_psd.png"

/**
 * Replaceable radar artwork. Keys are map ids from `getMapMetadata`.
 * Unknown / missing assets → overlay hides the radar.
 */
const RADAR_ASSETS: Record<string, string> = {
  de_anubis: anubisRadar,
}

export function getRadarAsset(mapId: string): string | undefined {
  return RADAR_ASSETS[mapId]
}
