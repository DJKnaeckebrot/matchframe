import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_vertigo.txt`, confirmed via SteamDatabase
 * GameTracking-CS2.
 *
 * pos_x -3168 / pos_y 1762, scale 4 at 1024×1024. Same XY for both floors.
 * `verticalsections` default (upper) vs lower; overlay swaps artwork by Z.
 */
const DE_VERTIGO_OVERVIEW = {
  pos_x: -3168,
  pos_y: 1762,
  scale: 4,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_VERTIGO: MapMetadata = {
  id: "de_vertigo",
  displayName: "Vertigo",
  radar: radarFromValveOverview(DE_VERTIGO_OVERVIEW),
  levels: [
    { id: "default", altitudeMin: 11700, altitudeMax: 20000 },
    { id: "lower", altitudeMin: -10000, altitudeMax: 11700 },
  ],
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_VERTIGO_OVERVIEW_SPAWNS = {
  ct: { x: 0.54, y: 0.25 },
  t: { x: 0.2, y: 0.75 },
} as const
