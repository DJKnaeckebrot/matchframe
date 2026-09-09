import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_mirage.txt`, confirmed via SteamDatabase
 * GameTracking-CS2.
 *
 * pos_x -3230 / pos_y 1713 are the world coordinates of the radar image's
 * top-left pixel. scale 5 is world units per pixel at 1024×1024.
 * Valve `rotate` is 0.
 */
const DE_MIRAGE_OVERVIEW = {
  pos_x: -3230,
  pos_y: 1713,
  scale: 5,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_MIRAGE: MapMetadata = {
  id: "de_mirage",
  displayName: "Mirage",
  radar: radarFromValveOverview(DE_MIRAGE_OVERVIEW),
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_MIRAGE_OVERVIEW_SPAWNS = {
  ct: { x: 0.28, y: 0.7 },
  t: { x: 0.87, y: 0.36 },
} as const
