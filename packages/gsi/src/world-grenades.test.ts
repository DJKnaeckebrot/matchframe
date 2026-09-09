import { describe, expect, test } from "bun:test"
import type { WorldGrenadeType } from "@workspace/game-state"

import { asWorldGrenadeType, normalizeWorldGrenades } from "./world-grenades"
import { normalizeGsiPayload } from "./normalize"
import { parseGsiPayload } from "./parse"

const CT = "76561198000000001"
const T = "76561198000000002"

describe("asWorldGrenadeType", () => {
  const cases: { raw: string; ownerSide?: "CT" | "T"; expected: WorldGrenadeType }[] = [
    { raw: "smoke", expected: "smoke" },
    { raw: "weapon_smokegrenade", expected: "smoke" },
    { raw: "flashbang", expected: "flash" },
    { raw: "frag", expected: "he" },
    { raw: "hegrenade", expected: "he" },
    { raw: "molotov", expected: "molotov" },
    { raw: "incgrenade", expected: "incendiary" },
    { raw: "decoy", expected: "decoy" },
    { raw: "firebomb", ownerSide: "T", expected: "molotov" },
    { raw: "firebomb", ownerSide: "CT", expected: "incendiary" },
    { raw: "inferno", ownerSide: "T", expected: "molotov" },
    { raw: "inferno", expected: "unknown" },
    { raw: "SMOKE", expected: "smoke" },
    { raw: "future_sensor", expected: "unknown" },
  ]

  for (const { raw, ownerSide, expected } of cases) {
    test(`${raw}${ownerSide ? ` ${ownerSide}` : ""} → ${expected}`, () => {
      expect(asWorldGrenadeType(raw, ownerSide)).toBe(expected)
    })
  }

  test("missing type is unknown", () => {
    expect(asWorldGrenadeType(undefined)).toBe("unknown")
  })
})

describe("normalizeWorldGrenades", () => {
  test("parses position, owner, velocity, lifetime, and effecttime", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        [CT]: { name: "Nova", team: "CT" },
      },
      grenades: {
        "291": {
          owner: CT,
          type: "smoke",
          position: "100, 200, 16",
          velocity: "12, -3, 40",
          lifetime: "1.4",
          effecttime: "0.0",
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data)).toEqual([
      {
        id: "291",
        type: "smoke",
        ownerSteamId: CT,
        position: { x: 100, y: 200, z: 16 },
        velocity: { x: 12, y: -3, z: 40 },
        lifetime: 1.4,
        effectTime: 0,
      },
    ])
  })

  test("unknown types still ingest when position is valid", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "9": { type: "tactical_awareness", position: "1, 2, 3" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data)).toEqual([
      { id: "9", type: "unknown", position: { x: 1, y: 2, z: 3 } },
    ])
  })

  test("drops grenades without a usable position", () => {
    expect(
      normalizeWorldGrenades({
        grenades: {
          "1": { type: "smoke", position: "nope" },
          "2": { type: "smoke" },
        },
      })
    ).toEqual([])
  })

  test("firebomb type follows owner side", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        [CT]: { team: "CT" },
        [T]: { team: "T" },
      },
      grenades: {
        "1": { owner: CT, type: "firebomb", position: "1, 2, 3" },
        "2": { owner: T, type: "inferno", position: "4, 5, 6" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const grenades = normalizeWorldGrenades(parsed.data)
    expect(grenades.map((grenade) => [grenade.id, grenade.type])).toEqual([
      ["1", "incendiary"],
      ["2", "molotov"],
    ])
  })

  test("empty grenades map is no world grenades", () => {
    expect(normalizeWorldGrenades({ grenades: {} })).toEqual([])
    expect(normalizeWorldGrenades({})).toEqual([])
  })

  test("malformed sibling grenades do not drop valid smokes or fail ingest", () => {
    const parsed = parseGsiPayload({
      grenades: {
        bad: "not-an-object",
        also: { type: 12, position: true },
        "401": { type: "smoke", position: "8, 9, 10", flames: ["not", "a", "map"] },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data)).toEqual([
      { id: "401", type: "smoke", position: { x: 8, y: 9, z: 10 } },
    ])
  })

  test("flames on inferno do not break parse and are not copied into GameState", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "7": {
          owner: T,
          type: "inferno",
          position: "10, 20, 30",
          flames: { flame_0: "10, 20, 30", flame_1: "12, 22, 30" },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const raw = parsed.data.grenades?.["7"]
    expect(raw).toEqual({
      owner: T,
      type: "inferno",
      position: "10, 20, 30",
      flames: { flame_0: "10, 20, 30", flame_1: "12, 22, 30" },
    })
    const state = normalizeGsiPayload(parsed.data)
    expect(state.worldGrenades).toEqual([
      { id: "7", type: "unknown", ownerSteamId: T, position: { x: 10, y: 20, z: 30 } },
    ])
    expect(JSON.stringify(state.worldGrenades)).not.toContain("flame")
  })
})
