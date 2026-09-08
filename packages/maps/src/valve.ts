import type { RadarBounds, ValveRadarOverview } from "./types"

export function radarFromValveOverview(overview: ValveRadarOverview): RadarBounds {
  const radar: RadarBounds = {
    posX: overview.pos_x,
    posY: overview.pos_y,
    scale: overview.scale,
    width: overview.imageSize,
    height: overview.imageSize,
  }
  if (overview.rotate !== undefined && overview.rotate !== 0) {
    radar.rotate = overview.rotate
  }
  return radar
}
