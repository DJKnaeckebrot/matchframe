import type { MapMetadata, RadarPoint, Vec2 } from "./types"

/**
 * World XY → normalized radar image coordinates.
 *
 *   x = (worldX - posX) / (scale * width)
 *   y = (posY - worldY) / (scale * height)
 *
 * Y is inverted because CS world +Y is north and radar image +Y is down.
 * Does not clamp; values outside 0..1 mean the point is off the image.
 */
export function worldToRadar(
  position: Vec2,
  metadata: MapMetadata
): RadarPoint | undefined {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return undefined
  }

  const { posX, posY, scale, width, height, rotate } = metadata.radar
  if (rotate !== undefined && rotate !== 0) {
    throw new Error(
      `Unsupported radar rotation ${rotate} for ${metadata.id}; v1 maps are rotate 0`
    )
  }

  const spanX = scale * width
  const spanY = scale * height
  if (!Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX === 0 || spanY === 0) {
    throw new Error(`Invalid radar scale/size for ${metadata.id}`)
  }

  return {
    x: (position.x - posX) / spanX,
    y: (posY - position.y) / spanY,
  }
}

/** Inverse of `worldToRadar` for tests and fixture construction. */
export function radarToWorld(point: RadarPoint, metadata: MapMetadata): Vec2 {
  const { posX, posY, scale, width, height, rotate } = metadata.radar
  if (rotate !== undefined && rotate !== 0) {
    throw new Error(
      `Unsupported radar rotation ${rotate} for ${metadata.id}; v1 maps are rotate 0`
    )
  }
  return {
    x: posX + point.x * scale * width,
    y: posY - point.y * scale * height,
  }
}

/**
 * World-unit radius → normalized radar image radius (fraction of image width).
 * Overlay presentation constants convert here — React must not do this math.
 */
export function worldRadiusToRadar(
  worldRadius: number,
  metadata: MapMetadata
): number | undefined {
  if (!Number.isFinite(worldRadius) || worldRadius < 0) {
    return undefined
  }

  const { scale, width, rotate } = metadata.radar
  if (rotate !== undefined && rotate !== 0) {
    throw new Error(
      `Unsupported radar rotation ${rotate} for ${metadata.id}; v1 maps are rotate 0`
    )
  }

  const span = scale * width
  if (!Number.isFinite(span) || span === 0) {
    throw new Error(`Invalid radar scale/size for ${metadata.id}`)
  }

  return worldRadius / span
}
