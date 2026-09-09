import { describe, expect, test } from "bun:test"
import type { WorldGrenadeType } from "@workspace/game-state"

import { asWorldGrenadeType, normalizeWorldGrenades } from "./world-grenades"
import { normalizeGsiPayload } from "./normalize"
import { parseGsiPayload } from "./parse"

const CT = "76561198000000001"
const T = "76561198000000002"

describe("asWorldGrenadeType", () => {
  const cases: { raw: string; expected: WorldGrenadeType }[] = [
    { raw: "smoke", expected: "smoke" },
    { raw: "weapon_smokegrenade", expected: "smoke" },
    { raw: "flashbang", expected: "flash" },
    { raw: "flash", expected: "flash" },
    { raw: "frag", expected: "he" },
    { raw: "hegrenade", expected: "he" },
    { raw: "molotov", expected: "molotov" },
    { raw: "incgrenade", expected: "incendiary" },
    { raw: "decoy", expected: "decoy" },
    { raw: "firebomb", expected: "molotov" },
    { raw: "inferno", expected: "molotov" },
    { raw: "SMOKE", expected: "smoke" },
    { raw: "future_sensor", expected: "unknown" },
  ]

  for (const { raw, expected } of cases) {
    test(`${raw} → ${expected}`, () => {
      expect(asWorldGrenadeType(raw)).toBe(expected)
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

  test("flashbang raw type becomes flash", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "354": { owner: T, type: "flashbang", position: "1, 2, 3", lifetime: "0.8" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data)[0]).toMatchObject({
      id: "354",
      type: "flash",
      ownerSteamId: T,
    })
  })

  test("frag raw type becomes he", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "12": { type: "frag", position: "8, 9, 10", velocity: "1, 2, 3" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data)[0]).toMatchObject({
      id: "12",
      type: "he",
      position: { x: 8, y: 9, z: 10 },
    })
  })

  test("decoy stays decoy", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "77": { type: "decoy", position: "4, 5, 6", lifetime: "12.0" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data)[0]?.type).toBe("decoy")
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

  test("keeps live inferno flame maps that have no root position", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "155": {
          owner: T,
          type: "inferno",
          lifetime: "3.029",
          flames: {
            flame_n1247_p399_n168: "-1247.0, 399.0, -168.0",
            flame_n1254_p469_n165: "-1254.0, 469.0, -165.0",
          },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const grenades = normalizeWorldGrenades(parsed.data)
    expect(grenades).toEqual([
      {
        id: "155",
        type: "molotov",
        ownerSteamId: T,
        lifetime: 3.029,
        flames: [
          { x: -1247, y: 399, z: -168 },
          { x: -1254, y: 469, z: -165 },
        ],
      },
    ])
    expect(grenades[0]?.position).toBeUndefined()
  })

  test("firebomb and inferno stay conservative molotov, not owner-side weapon identity", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        [CT]: { team: "CT" },
        [T]: { team: "T" },
      },
      grenades: {
        "1": { owner: CT, type: "firebomb", position: "1, 2, 3" },
        "2": { owner: T, type: "inferno", position: "4, 5, 6" },
        "3": { type: "inferno", position: "7, 8, 9" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const grenades = normalizeWorldGrenades(parsed.data)
    expect(grenades.map((grenade) => [grenade.id, grenade.type])).toEqual([
      ["1", "molotov"],
      ["2", "molotov"],
      ["3", "molotov"],
    ])
    expect(grenades[0]?.ownerSteamId).toBe(CT)
    expect(grenades[1]?.ownerSteamId).toBe(T)
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

  test("copies valid inferno flame positions as Vector3 and skips malformed entries", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "7": {
          owner: T,
          type: "inferno",
          position: "10, 20, 30",
          flames: {
            flame_0: "10, 20, 30",
            flame_1: "12, 22, 30",
            flame_bad: "nope",
            flame_empty: "",
            flame_obj: { x: 1 },
          },
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
      flames: {
        flame_0: "10, 20, 30",
        flame_1: "12, 22, 30",
        flame_bad: "nope",
        flame_empty: "",
        flame_obj: { x: 1 },
      },
    })
    const state = normalizeGsiPayload(parsed.data)
    expect(state.worldGrenades).toEqual([
      {
        id: "7",
        type: "molotov",
        ownerSteamId: T,
        position: { x: 10, y: 20, z: 30 },
        flames: [
          { x: 10, y: 20, z: 30 },
          { x: 12, y: 22, z: 30 },
        ],
      },
    ])
    expect(JSON.stringify(state.worldGrenades)).not.toContain("flame_0")
  })

  test("incgrenade flames normalize to incendiary without Valve keys", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "8": {
          owner: CT,
          type: "incgrenade",
          position: "20, 21, 22",
          flames: { flame_0: "20, 21, 22", flame_1: "24, 23, 22" },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeGsiPayload(parsed.data).worldGrenades).toEqual([
      {
        id: "8",
        type: "incendiary",
        ownerSteamId: CT,
        position: { x: 20, y: 21, z: 22 },
        flames: [
          { x: 20, y: 21, z: 22 },
          { x: 24, y: 23, z: 22 },
        ],
      },
    ])
  })

  test("keeps flash, he, decoy, and firebomb in one collection", () => {
    const parsed = parseGsiPayload({
      grenades: {
        "1": { type: "flashbang", position: "1, 1, 1" },
        "2": { type: "frag", position: "2, 2, 2" },
        "3": { type: "decoy", position: "3, 3, 3" },
        "4": { type: "firebomb", position: "4, 4, 4" },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeWorldGrenades(parsed.data).map((grenade) => grenade.type)).toEqual([
      "flash",
      "he",
      "decoy",
      "molotov",
    ])
  })
})
