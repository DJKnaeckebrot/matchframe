import { describe, expect, test } from "bun:test"

import {
  compactOverlayConfig,
  defaultOverlayConfig,
  overlayConfigSchema,
  overlayTeamName,
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
  })
})

describe("compactOverlayConfig", () => {
  test("drops blank team names", () => {
    expect(compactOverlayConfig({ series: "BO3", leftName: "", rightName: "Redline" })).toEqual({
      series: "BO3",
      rightName: "Redline",
    })
  })
})

describe("overlayTeamName", () => {
  test("uses the override when set, otherwise the in-game name", () => {
    expect(overlayTeamName({ leftName: "FaZe" }, "left", "CT")).toBe("FaZe")
    expect(overlayTeamName({ leftName: "FaZe" }, "right", "Redline")).toBe("Redline")
    expect(overlayTeamName({}, "left", "Northwind")).toBe("Northwind")
  })
})
