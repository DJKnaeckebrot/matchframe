import type { Vec2 } from "./types"

/**
 * 2D facing as clockwise degrees from world +Y (north).
 *
 * An up-pointing marker plus CSS `rotate(angle)` matches native radar:
 * +X east → 90°, +Y north → 0°, −X west → −90°, −Y south → 180°.
 *
 * Uses atan2(x, y), not atan2(y, x). Z is ignored. Zero/invalid → undefined.
 */
export function getFacingAngle(forward: Vec2): number | undefined {
  if (!Number.isFinite(forward.x) || !Number.isFinite(forward.y)) {
    return undefined
  }
  if (forward.x === 0 && forward.y === 0) {
    return undefined
  }
  return (Math.atan2(forward.x, forward.y) * 180) / Math.PI
}
