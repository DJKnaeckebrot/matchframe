import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_inferno.txt`, confirmed via SteamDatabase
 * GameTracking-CS2.
 *
 * pos_x -2087 / pos_y 3870 are the world coordinates of the radar image's
 * top-left pixel. scale 4.9 is world units per pixel at 1024×1024.
 */
const DE_INFERNO_OVERVIEW = {
  pos_x: -2087,
  pos_y: 3870,
  scale: 4.9,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_INFERNO: MapMetadata = {
  id: "de_inferno",
  displayName: "Inferno",
  radar: radarFromValveOverview(DE_INFERNO_OVERVIEW),
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_INFERNO_OVERVIEW_SPAWNS = {
  ct: { x: 0.9, y: 0.35 },
  t: { x: 0.1, y: 0.67 },
} as const
