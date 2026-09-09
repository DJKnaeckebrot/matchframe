import { describe, expect, test } from "bun:test"
import { createGameStateEngine } from "@workspace/game-state"

import { createGsiStateManager } from "./manager"
import { normalizeGsiPayload } from "./normalize"
import { parseGsiPayload } from "./parse"

const OWNER = "76561198000000004"

const flightPath = new URL("../fixtures/cs2-mirage-molotov-flight.json", import.meta.url)
const activePath = new URL("../fixtures/cs2-mirage-inferno-active.json", import.meta.url)
const expiredPath = new URL("../fixtures/cs2-mirage-inferno-expired.json", import.meta.url)

function ingest(gsi: ReturnType<typeof createGsiStateManager>, payload: unknown) {
  gsi.update(payload)
  const parsed = parseGsiPayload(gsi.getState())
  expect(parsed.success).toBe(true)
  if (!parsed.success) {
    throw new Error("merged GSI failed Matchframe parse")
  }
  return normalizeGsiPayload(parsed.data)
}

describe("real CS2 molotov lifecycle", () => {
  // Flight JSON uses the live grenade field set (owner/position/velocity/lifetime/type).
  // The captured burning window had inferno 155 with no firebomb tick.
  test("captured inferno has no root position and keeps encoded flame keys as points", async () => {
    const payload = await Bun.file(activePath).json()
    const parsed = parseGsiPayload(payload)
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const inferno = parsed.data.grenades?.["155"]
    expect(inferno).toMatchObject({
      owner: OWNER,
      type: "inferno",
      lifetime: "3.029",
    })
    expect(inferno).not.toHaveProperty("position")
    expect(inferno).not.toHaveProperty("velocity")
    const flames = (inferno as { flames?: Record<string, unknown> }).flames
    expect(flames).toBeDefined()
    expect(Array.isArray(flames)).toBe(false)
    const keys = Object.keys(flames ?? {})
    expect(keys.some((key) => key.startsWith("flame_n") || key.startsWith("flame_p"))).toBe(true)
    expect(keys.some((key) => key === "flame_0")).toBe(false)
    expect(Object.values(flames ?? {}).every((value) => typeof value === "string")).toBe(true)

    const state = normalizeGsiPayload(parsed.data)
    expect(state.worldGrenades).toHaveLength(1)
    expect(state.worldGrenades[0]).toMatchObject({
      id: "155",
      type: "molotov",
      ownerSteamId: OWNER,
    })
    expect(state.worldGrenades[0]?.position).toBeUndefined()
    expect(state.worldGrenades[0]?.flames?.length).toBe(15)
    expect(state.worldGrenades[0]?.flames?.[0]).toEqual({ x: -1247, y: 399, z: -168 })
  })

  test("projectile then ignition then expiry: fire entity survives without inventing a position", async () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()

    const flying = ingest(gsi, await Bun.file(flightPath).json())
    expect(flying.worldGrenades.map((grenade) => [grenade.id, grenade.type, Boolean(grenade.flames)])).toEqual([
      ["140", "molotov", false],
    ])
    expect(flying.worldGrenades[0]?.position).toEqual({ x: -1104.2, y: 188.6, z: -96.4 })
    engine.apply(flying)

    const burning = ingest(gsi, await Bun.file(activePath).json())
    const raw = gsi.getState() as { grenades?: Record<string, unknown> }
    expect(raw.grenades).not.toHaveProperty("140")
    expect(raw.grenades).toHaveProperty("155")
    expect(burning.worldGrenades.map((grenade) => grenade.id)).toEqual(["155"])
    expect(burning.worldGrenades[0]?.flames?.length).toBe(15)
    expect(burning.worldGrenades[0]?.position).toBeUndefined()
    engine.apply(burning)

    const expired = ingest(gsi, await Bun.file(expiredPath).json())
    expect(expired.worldGrenades).toEqual([])
  })
})
