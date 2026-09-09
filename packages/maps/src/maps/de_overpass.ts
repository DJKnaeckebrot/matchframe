import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_overpass.txt`, confirmed via SteamDatabase
 * GameTracking-CS2.
 *
 * pos_x -4831 / pos_y 1781 are the world coordinates of the radar image's
 * top-left pixel. scale 5.2 is world units per pixel at 1024×1024.
 * Valve `rotate` is 0.
 */
const DE_OVERPASS_OVERVIEW = {
  pos_x: -4831,
  pos_y: 1781,
  scale: 5.2,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_OVERPASS: MapMetadata = {
  id: "de_overpass",
  displayName: "Overpass",
  radar: radarFromValveOverview(DE_OVERPASS_OVERVIEW),
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_OVERPASS_OVERVIEW_SPAWNS = {
  ct: { x: 0.49, y: 0.2 },
  t: { x: 0.66, y: 0.93 },
} as const
