import { describe, expect, test } from "bun:test"

import { getMapLevelForZ } from "./levels"
import { DE_INFERNO } from "./maps/de_inferno"
import { DE_MIRAGE } from "./maps/de_mirage"
import { DE_NUKE } from "./maps/de_nuke"
import { DE_OVERPASS } from "./maps/de_overpass"
import { DE_VERTIGO } from "./maps/de_vertigo"
import { getMapMetadata, isRadarSupported, mapDisplayName, mapIdFromName } from "./registry"

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

  test("resolves the rest of the active duty pool", () => {
    expect(getMapMetadata("de_inferno")).toEqual(DE_INFERNO)
    expect(getMapMetadata("de_mirage")).toEqual(DE_MIRAGE)
    expect(getMapMetadata("de_overpass")).toEqual(DE_OVERPASS)
    expect(getMapMetadata("de_nuke")).toEqual(DE_NUKE)
    expect(getMapMetadata("de_vertigo")).toEqual(DE_VERTIGO)
  })

  test("unknown maps return undefined", () => {
    expect(getMapMetadata("de_dust2")).toBeUndefined()
    expect(getMapMetadata("")).toBeUndefined()
  })

  test("radar support follows the registry, not a dashboard list", () => {
    expect(isRadarSupported("de_mirage")).toBe(true)
    expect(isRadarSupported("workshop/1/de_anubis")).toBe(true)
    expect(isRadarSupported("de_cache")).toBe(false)
    expect(isRadarSupported("")).toBe(false)
  })

  test("display names come from metadata, with the map id as fallback", () => {
    expect(mapDisplayName("de_mirage")).toBe("Mirage")
    expect(mapDisplayName("workshop/123/de_nuke")).toBe("Nuke")
    expect(mapDisplayName("de_cache")).toBe("de_cache")
  })

  test("workshop-style names still match the map id", () => {
    expect(mapIdFromName("workshop/123456/de_anubis")).toBe("de_anubis")
    expect(getMapMetadata("workshop/123456/de_nuke")?.id).toBe("de_nuke")
  })
})

describe("getMapLevelForZ", () => {
  test("single-level maps have no floor split", () => {
    expect(getMapLevelForZ(DE_INFERNO, 0)).toBeUndefined()
  })

  test("Nuke upper is above -495, lower is at or below", () => {
    expect(getMapLevelForZ(DE_NUKE, -494)?.id).toBe("default")
    expect(getMapLevelForZ(DE_NUKE, 120)?.id).toBe("default")
    expect(getMapLevelForZ(DE_NUKE, -495)?.id).toBe("lower")
    expect(getMapLevelForZ(DE_NUKE, -800)?.id).toBe("lower")
  })

  test("Vertigo upper is above 11700, lower is at or below", () => {
    expect(getMapLevelForZ(DE_VERTIGO, 11701)?.id).toBe("default")
    expect(getMapLevelForZ(DE_VERTIGO, 15000)?.id).toBe("default")
    expect(getMapLevelForZ(DE_VERTIGO, 11700)?.id).toBe("lower")
    expect(getMapLevelForZ(DE_VERTIGO, 11000)?.id).toBe("lower")
  })
})
