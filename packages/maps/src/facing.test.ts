import { describe, expect, test } from "bun:test"

import { getFacingAngle } from "./facing"

describe("getFacingAngle", () => {
  test("north (+Y) is 0° for an up-pointing marker", () => {
    expect(getFacingAngle({ x: 0, y: 1 })).toBeCloseTo(0, 10)
  })

  test("east (+X) is 90° clockwise", () => {
    expect(getFacingAngle({ x: 1, y: 0 })).toBeCloseTo(90, 10)
  })

  test("south (−Y) is 180°", () => {
    expect(getFacingAngle({ x: 0, y: -1 })).toBeCloseTo(180, 10)
  })

  test("west (−X) is −90°", () => {
    expect(getFacingAngle({ x: -1, y: 0 })).toBeCloseTo(-90, 10)
  })

  test("rejects a zero or non-finite vector", () => {
    expect(getFacingAngle({ x: 0, y: 0 })).toBeUndefined()
    expect(getFacingAngle({ x: Number.NaN, y: 1 })).toBeUndefined()
    expect(getFacingAngle({ x: 1, y: Number.POSITIVE_INFINITY })).toBeUndefined()
  })
})
