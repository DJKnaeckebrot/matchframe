import { describe, expect, test } from "bun:test"

import {
  compactOverlayConfig,
  defaultOverlayConfig,
  overlayConfigSchema,
  overlaySeriesWins,
  overlaySeriesWinsChanged,
  overlayTeamName,
  seriesWinsNeeded,
} from "./overlay-config"

describe("overlayConfigSchema", () => {
  test("defaults to a single map", () => {
    expect(defaultOverlayConfig).toEqual({ series: "BO1" })
  })

  test("accepts series lengths", () => {
    expect(overlayConfigSchema.parse({ series: "BO3" })).toEqual({ series: "BO3" })
    expect(overlayConfigSchema.parse({ series: "BO5" }).series).toBe("BO5")
  })

  test("accepts team display names", () => {
    expect(
      overlayConfigSchema.parse({ series: "BO3", leftName: " Northwind ", rightName: "Redline" })
    ).toEqual({
      series: "BO3",
      leftName: "Northwind",
      rightName: "Redline",
    })
  })

  test("rejects unknown formats and overlong names", () => {
    expect(overlayConfigSchema.safeParse({ series: "BO2" }).success).toBe(false)
    expect(overlayConfigSchema.safeParse({}).success).toBe(false)
    expect(
      overlayConfigSchema.safeParse({ series: "BO1", leftName: "n".repeat(33) }).success
    ).toBe(false)
    expect(
      overlayConfigSchema.safeParse({ series: "BO3", leftWins: 5, rightWins: 0 }).success
    ).toBe(false)
  })

  test("accepts map wins", () => {
    expect(overlayConfigSchema.parse({ series: "BO3", leftWins: 1, rightWins: 0 })).toEqual({
      series: "BO3",
      leftWins: 1,
      rightWins: 0,
    })
  })
})

describe("compactOverlayConfig", () => {
  test("drops blank team names", () => {
    expect(compactOverlayConfig({ series: "BO3", leftName: "", rightName: "Redline" })).toEqual({
      series: "BO3",
      rightName: "Redline",
    })
  })

  test("keeps explicit map wins including 0-0", () => {
    expect(compactOverlayConfig({ series: "BO3", leftWins: 1, rightWins: 0 })).toEqual({
      series: "BO3",
      leftWins: 1,
      rightWins: 0,
    })
    expect(compactOverlayConfig({ series: "BO3", leftWins: 0, rightWins: 0 })).toEqual({
      series: "BO3",
      leftWins: 0,
      rightWins: 0,
    })
  })

  test("clamps map wins to the series and drops them on BO1", () => {
    expect(compactOverlayConfig({ series: "BO3", leftWins: 4, rightWins: 1 })).toEqual({
      series: "BO3",
      leftWins: 2,
      rightWins: 1,
    })
    expect(compactOverlayConfig({ series: "BO1", leftWins: 1, rightWins: 0 })).toEqual({
      series: "BO1",
    })
  })
})

describe("series wins helpers", () => {
  test("wins needed follows first-to", () => {
    expect(seriesWinsNeeded("BO1")).toBe(0)
    expect(seriesWinsNeeded("BO3")).toBe(2)
    expect(seriesWinsNeeded("BO5")).toBe(3)
    expect(seriesWinsNeeded("BO7")).toBe(4)
  })

  test("treats missing wins as unchanged", () => {
    expect(overlaySeriesWins({ series: "BO3" })).toBeUndefined()
    expect(overlaySeriesWinsChanged({ series: "BO3" }, { series: "BO3", leftName: "FaZe" })).toBe(
      false
    )
    expect(
      overlaySeriesWinsChanged({ series: "BO3" }, { series: "BO3", leftWins: 0, rightWins: 0 })
    ).toBe(true)
  })
})

describe("overlayTeamName", () => {
  test("uses the override when set, otherwise the in-game name", () => {
    expect(overlayTeamName({ leftName: "FaZe" }, "left", "CT")).toBe("FaZe")
    expect(overlayTeamName({ leftName: "FaZe" }, "right", "Redline")).toBe("Redline")
    expect(overlayTeamName({}, "left", "Northwind")).toBe("Northwind")
  })
})
