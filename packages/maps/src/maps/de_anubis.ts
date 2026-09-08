import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_anubis.txt` (TAVR auto radar v2.5.0a),
 * confirmed via SteamDatabase GameTracking-CS2.
 *
 * pos_x -2796 / pos_y 3328 are the world coordinates of the radar image's
 * top-left pixel. scale 5.22 is world units per pixel at 1024×1024.
 */
const DE_ANUBIS_OVERVIEW = {
  pos_x: -2796,
  pos_y: 3328,
  scale: 5.22,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_ANUBIS: MapMetadata = {
  id: "de_anubis",
  displayName: "Anubis",
  radar: radarFromValveOverview(DE_ANUBIS_OVERVIEW),
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_ANUBIS_OVERVIEW_SPAWNS = {
  ct: { x: 0.61, y: 0.22 },
  t: { x: 0.58, y: 0.93 },
} as const
