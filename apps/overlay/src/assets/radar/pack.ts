import ancientRadar from "./de_ancient_radar_psd.png"
import anubisRadar from "./de_anubis_radar_psd.png"
import infernoRadar from "./de_inferno_radar_psd.png"
import mirageRadar from "./de_mirage_radar_psd.png"
import nukeRadar from "./de_nuke_radar_psd.png"
import nukeLowerRadar from "./de_nuke_lower_radar_psd.png"
import overpassRadar from "./de_overpass_radar_psd.png"
import vertigoRadar from "./de_vertigo_radar_psd.png"
import vertigoLowerRadar from "./de_vertigo_lower_radar_psd.png"

/**
 * Replaceable radar artwork. Keys are map ids from `getMapMetadata`.
 * Stacked floors use `${mapId}:${levelId}` (Valve `lower`).
 * Unknown / missing assets → overlay hides the radar.
 */
const RADAR_ASSETS: Record<string, string> = {
  de_ancient: ancientRadar,
  de_anubis: anubisRadar,
  de_inferno: infernoRadar,
  de_mirage: mirageRadar,
  de_nuke: nukeRadar,
  "de_nuke:lower": nukeLowerRadar,
  de_overpass: overpassRadar,
  de_vertigo: vertigoRadar,
  "de_vertigo:lower": vertigoLowerRadar,
}

export function getRadarAsset(mapId: string, levelId?: string): string | undefined {
  if (levelId && levelId !== "default") {
    return RADAR_ASSETS[`${mapId}:${levelId}`] ?? RADAR_ASSETS[mapId]
  }
  return RADAR_ASSETS[mapId]
}
