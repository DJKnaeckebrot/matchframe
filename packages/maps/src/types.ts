export type Vec2 = {
  x: number
  y: number
}

export type Vec3 = {
  x: number
  y: number
  z: number
}

/** Normalized radar image coordinates. Unclamped; 0..1 is on the image. */
export type RadarPoint = {
  x: number
  y: number
}

/**
 * One stacked floor. v1 uses the map's primary `radar` image for every
 * level; later maps (Nuke, Vertigo) can add per-level assets and Z ranges.
 */
export type MapLevel = {
  id: string
  altitudeMin: number
  altitudeMax: number
}

export type RadarBounds = {
  /** World X of the radar image's top-left pixel. Valve `pos_x`. */
  posX: number
  /** World Y of the radar image's top-left pixel. Valve `pos_y`. */
  posY: number
  /** World units per radar pixel at `width`/`height`. Valve `scale`. */
  scale: number
  /** Pixel width the Valve scale was authored against (typically 1024). */
  width: number
  /** Pixel height the Valve scale was authored against (typically 1024). */
  height: number
  /**
   * Clockwise degrees. Valve overview `rotate` is 0 / omitted for Anubis.
   * Non-zero values are rejected by the transform until a rotated map is added.
   */
  rotate?: number
}

export type MapMetadata = {
  id: string
  displayName: string
  radar: RadarBounds
  levels?: readonly MapLevel[]
}

/**
 * Raw CS2 overview fields. Keep Valve names here; `MapMetadata` is the
 * game-independent shape the overlay consumes.
 */
export type ValveRadarOverview = {
  pos_x: number
  pos_y: number
  scale: number
  /** Overview texture size the `scale` value applies to. */
  imageSize: number
  rotate?: number
}
