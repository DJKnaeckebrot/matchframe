import { describe, expect, test } from "bun:test"

import { getMapMetadata, mapIdFromName } from "./registry"

describe("getMapMetadata", () => {
  test("resolves de_anubis", () => {
    const meta = getMapMetadata("de_anubis")
    expect(meta?.id).toBe("de_anubis")
    expect(meta?.displayName).toBe("Anubis")
    expect(meta?.radar).toEqual({
      posX: -2796,
      posY: 3328,
      scale: 5.22,
      width: 1024,
      height: 1024,
    })
    expect(meta?.levels).toBeUndefined()
  })

  test("resolves de_ancient", () => {
    const meta = getMapMetadata("de_ancient")
    expect(meta?.id).toBe("de_ancient")
    expect(meta?.displayName).toBe("Ancient")
    expect(meta?.radar).toEqual({
      posX: -2953,
      posY: 2164,
      scale: 5,
      width: 1024,
      height: 1024,
    })
    expect(meta?.levels).toBeUndefined()
  })

  test("unknown maps return undefined", () => {
    expect(getMapMetadata("de_dust2")).toBeUndefined()
    expect(getMapMetadata("")).toBeUndefined()
  })

  test("workshop-style names still match the map id", () => {
    expect(mapIdFromName("workshop/123456/de_anubis")).toBe("de_anubis")
    expect(getMapMetadata("workshop/123456/de_anubis")?.id).toBe("de_anubis")
  })
})
