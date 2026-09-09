import type { RadarPoint } from "@workspace/maps"

/** Regular polygon used to pad each flame before the hull. */
const PAD_SIDES = 8

/**
 * Padded convex hull of inferno flame anchors in radar image space.
 * Each flame expands by `radius` (one cell), then the set is hulled so
 * the patch reads as occupied ground — not a smoke circle or a polyline.
 */
export function radarFireArea(
  flamePoints: readonly RadarPoint[],
  radius: number
): RadarPoint[] | undefined {
  if (flamePoints.length === 0) {
    return undefined
  }
  const vertices = radius > 0 ? paddedFlameVertices(flamePoints, radius) : [...flamePoints]
  const hull = convexHull(vertices)
  return hull.length >= 3 ? hull : undefined
}

function paddedFlameVertices(points: readonly RadarPoint[], radius: number): RadarPoint[] {
  const vertices: RadarPoint[] = []
  for (const point of points) {
    for (let i = 0; i < PAD_SIDES; i++) {
      const angle = (Math.PI * 2 * i) / PAD_SIDES
      vertices.push({
        x: point.x + Math.cos(angle) * radius,
        y: point.y + Math.sin(angle) * radius,
      })
    }
  }
  return vertices
}

/** Andrew's monotone chain. Image-space Y-down does not matter for SVG fill. */
export function convexHull(points: readonly RadarPoint[]): RadarPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (sorted.length <= 1) {
    return sorted
  }

  const lower: RadarPoint[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: RadarPoint[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function cross(origin: RadarPoint, a: RadarPoint, b: RadarPoint): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
}
