import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_ancient.txt`, confirmed via SteamDatabase
 * GameTracking-CS2.
 *
 * pos_x -2953 / pos_y 2164 are the world coordinates of the radar image's
 * top-left pixel. scale 5 is world units per pixel at 1024×1024.
 */
const DE_ANCIENT_OVERVIEW = {
  pos_x: -2953,
  pos_y: 2164,
  scale: 5,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_ANCIENT: MapMetadata = {
  id: "de_ancient",
  displayName: "Ancient",
  radar: radarFromValveOverview(DE_ANCIENT_OVERVIEW),
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_ANCIENT_OVERVIEW_SPAWNS = {
  ct: { x: 0.51, y: 0.17 },
  t: { x: 0.485, y: 0.87 },
} as const
