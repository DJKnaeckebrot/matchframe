import { describe, expect, test } from "bun:test"

import { DE_MIRAGE, DE_MIRAGE_OVERVIEW_SPAWNS } from "./maps/de_mirage"
import { DE_ANUBIS, DE_ANUBIS_OVERVIEW_SPAWNS } from "./maps/de_anubis"
import { radarToWorld, worldRadiusToRadar, worldToRadar } from "./transform"
import type { MapMetadata } from "./types"

const origin = { x: DE_ANUBIS.radar.posX, y: DE_ANUBIS.radar.posY }

describe("worldToRadar", () => {
  test("map origin (pos_x, pos_y) is the top-left of the image", () => {
    expect(worldToRadar(origin, DE_ANUBIS)).toEqual({ x: 0, y: 0 })
  })

  test("east (+world X) increases radar X", () => {
    const east = worldToRadar({ x: origin.x + 522, y: origin.y }, DE_ANUBIS)
    expect(east?.x).toBeCloseTo(522 / (5.22 * 1024), 10)
    expect(east?.y).toBeCloseTo(0, 10)
    expect(east!.x).toBeGreaterThan(0)
  })

  test("west (−world X) decreases radar X", () => {
    const west = worldToRadar({ x: origin.x - 522, y: origin.y }, DE_ANUBIS)
    expect(west?.x).toBeLessThan(0)
    expect(west?.y).toBeCloseTo(0, 10)
  })

  test("north (+world Y) decreases radar Y (axis inversion)", () => {
    const north = worldToRadar({ x: origin.x, y: origin.y + 522 }, DE_ANUBIS)
    expect(north?.x).toBeCloseTo(0, 10)
    expect(north?.y).toBeLessThan(0)
  })

  test("south (−world Y) increases radar Y", () => {
    const south = worldToRadar({ x: origin.x, y: origin.y - 522 }, DE_ANUBIS)
    expect(south?.x).toBeCloseTo(0, 10)
    expect(south!.y).toBeGreaterThan(0)
  })

  test("bottom-right image corner is (1, 1)", () => {
    const corner = radarToWorld({ x: 1, y: 1 }, DE_ANUBIS)
    expect(worldToRadar(corner, DE_ANUBIS)).toEqual({ x: 1, y: 1 })
  })

  test("overview spawn markers round-trip to their documented 0..1 points", () => {
    for (const spawn of Object.values(DE_ANUBIS_OVERVIEW_SPAWNS)) {
      const world = radarToWorld(spawn, DE_ANUBIS)
      const radar = worldToRadar(world, DE_ANUBIS)
      expect(radar?.x).toBeCloseTo(spawn.x, 10)
      expect(radar?.y).toBeCloseTo(spawn.y, 10)
    }
  })

  test("Mirage uses the same transform with its own Valve scale", () => {
    const world = radarToWorld(DE_MIRAGE_OVERVIEW_SPAWNS.ct, DE_MIRAGE)
    const radar = worldToRadar(world, DE_MIRAGE)
    expect(radar?.x).toBeCloseTo(DE_MIRAGE_OVERVIEW_SPAWNS.ct.x, 10)
    expect(radar?.y).toBeCloseTo(DE_MIRAGE_OVERVIEW_SPAWNS.ct.y, 10)
  })

  test("does not clamp points that sit off the image", () => {
    const off = worldToRadar(
      { x: origin.x + 5.22 * 1024 * 1.5, y: origin.y - 5.22 * 1024 * 0.25 },
      DE_ANUBIS
    )
    expect(off).toEqual({ x: 1.5, y: 0.25 })
  })

  test("invalid position is undefined, not a crash", () => {
    expect(worldToRadar({ x: Number.NaN, y: 0 }, DE_ANUBIS)).toBeUndefined()
    expect(worldToRadar({ x: 0, y: Number.POSITIVE_INFINITY }, DE_ANUBIS)).toBeUndefined()
  })

  test("zero scale throws instead of hiding the error", () => {
    const broken: MapMetadata = {
      ...DE_ANUBIS,
      radar: { ...DE_ANUBIS.radar, scale: 0 },
    }
    expect(() => worldToRadar(origin, broken)).toThrow(/Invalid radar scale/)
  })

  test("non-zero Valve rotate throws until a rotated map is supported", () => {
    const rotated: MapMetadata = {
      ...DE_ANUBIS,
      radar: { ...DE_ANUBIS.radar, rotate: 90 },
    }
    expect(() => worldToRadar(origin, rotated)).toThrow(/Unsupported radar rotation/)
  })
})

describe("worldRadiusToRadar", () => {
  test("divides world units by scale * width", () => {
    expect(worldRadiusToRadar(5.22 * 1024, DE_ANUBIS)).toBe(1)
    expect(worldRadiusToRadar(522, DE_ANUBIS)).toBeCloseTo(522 / (5.22 * 1024), 10)
  })

  test("invalid radius is undefined, not a crash", () => {
    expect(worldRadiusToRadar(Number.NaN, DE_ANUBIS)).toBeUndefined()
    expect(worldRadiusToRadar(-1, DE_ANUBIS)).toBeUndefined()
  })
})
