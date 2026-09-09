import { describe, expect, test } from "bun:test"

import { convexHull, radarFireArea } from "./radar-fire-area"

describe("radarFireArea", () => {
  test("empty flames yield no area", () => {
    expect(radarFireArea([], 0.02)).toBeUndefined()
  })

  test("one flame becomes a padded patch, not a single vertex", () => {
    const area = radarFireArea([{ x: 0.5, y: 0.45 }], 0.02)
    expect(area?.length).toBeGreaterThanOrEqual(3)
    expect(inside(area, { x: 0.5, y: 0.45 })).toBe(true)
    expect(inside(area, { x: 0.5 + 0.019, y: 0.45 })).toBe(true)
    expect(inside(area, { x: 0.5 + 0.04, y: 0.45 })).toBe(false)
  })

  test("several flames hull as one patch covering every anchor", () => {
    const flames = [
      { x: 0.5, y: 0.45 },
      { x: 0.52, y: 0.46 },
      { x: 0.498, y: 0.462 },
      { x: 0.53, y: 0.442 },
    ]
    const area = radarFireArea(flames, 0.015)
    expect(area?.length).toBeGreaterThanOrEqual(3)
    for (const flame of flames) {
      expect(inside(area, flame)).toBe(true)
    }
  })

  test("two close flames stay one capsule, not two disjoint blobs", () => {
    const area = radarFireArea(
      [
        { x: 0.5, y: 0.5 },
        { x: 0.53, y: 0.5 },
      ],
      0.02
    )
    expect(inside(area, { x: 0.515, y: 0.5 })).toBe(true)
  })

  test("missing radius still hulls three raw points", () => {
    const area = radarFireArea(
      [
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.4 },
        { x: 0.45, y: 0.5 },
      ],
      0
    )
    expect(area).toHaveLength(3)
  })
})

describe("convexHull", () => {
  test("square corners stay convex and drop the interior", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
    ])
    expect(hull).toHaveLength(4)
    expect(hull.map((point) => [point.x, point.y])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ])
  })
})

function inside(
  polygon: readonly { x: number; y: number }[] | undefined,
  point: { x: number; y: number }
): boolean {
  if (!polygon || polygon.length < 3) {
    return false
  }
  let winding = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    const crosses =
      a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) {
      winding = !winding
    }
  }
  return winding
}
