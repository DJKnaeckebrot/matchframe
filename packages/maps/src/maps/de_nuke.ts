import type { MapMetadata, ValveRadarOverview } from "../types"
import { radarFromValveOverview } from "../valve"

/**
 * CS2 `resource/overviews/de_nuke.txt`, confirmed via SteamDatabase
 * GameTracking-CS2.
 *
 * pos_x -3453 / pos_y 2887, scale 7 at 1024×1024. Same XY for both floors.
 * `verticalsections` default (upper) vs lower; overlay swaps artwork by Z.
 */
const DE_NUKE_OVERVIEW = {
  pos_x: -3453,
  pos_y: 2887,
  scale: 7,
  imageSize: 1024,
} as const satisfies ValveRadarOverview

export const DE_NUKE: MapMetadata = {
  id: "de_nuke",
  displayName: "Nuke",
  radar: radarFromValveOverview(DE_NUKE_OVERVIEW),
  levels: [
    { id: "default", altitudeMin: -495, altitudeMax: 10000 },
    { id: "lower", altitudeMin: -10000, altitudeMax: -495 },
  ],
}

/** Overview `CTSpawn_*` / `TSpawn_*` are already normalized 0..1 radar points. */
export const DE_NUKE_OVERVIEW_SPAWNS = {
  ct: { x: 0.82, y: 0.45 },
  t: { x: 0.19, y: 0.54 },
} as const
