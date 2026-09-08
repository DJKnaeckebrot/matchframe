import { describe, expect, test } from "bun:test"

import { normalizeGsiPayload } from "./normalize"
import { parseGsiPayload } from "./parse"

const fixturePath = new URL("../fixtures/inferno-live.json", import.meta.url)

function parsedFixture() {
  return Bun.file(fixturePath)
    .json()
    .then((payload: unknown) => {
      const result = parseGsiPayload(payload)
      if (!result.success) {
        throw new Error("fixture failed to parse")
      }
      return result.data
    })
}

describe("normalizeGsiPayload", () => {
  test("produces the expected map", async () => {
    const state = normalizeGsiPayload(await parsedFixture())

    expect(state.map).toEqual({
      name: "de_inferno",
      phase: "live",
      round: 14,
    })
  })

  test("produces the expected team scores", async () => {
    const state = normalizeGsiPayload(await parsedFixture())

    expect(state.teams).toEqual([
      { id: "northwind", name: "Northwind", side: "CT", score: 8 },
      { id: "redline", name: "Redline", side: "T", score: 6 },
    ])
  })

  test("produces the expected players", async () => {
    const state = normalizeGsiPayload(await parsedFixture())
    const byName = Object.fromEntries(
      state.players.map((player) => [player.name, player])
    )

    expect(state.players).toHaveLength(6)
    expect(state.observer.playerSteamId).toBe("76561198000000001")

    expect(byName.Nova).toMatchObject({
      steamId: "76561198000000001",
      teamId: "northwind",
      side: "CT",
      alive: true,
      health: 100,
      armor: 100,
      money: 2700,
      kills: 12,
      assists: 3,
      deaths: 8,
    })
    expect(byName.Nova.equipment).toMatchObject({
      hasHelmet: true,
      hasDefuseKit: false,
      hasBomb: false,
      primary: {
        id: "m4a4",
        name: "M4A4",
        type: "rifle",
        active: true,
        ammoClip: 25,
        ammoReserve: 90,
      },
      secondary: {
        id: "usp_s",
        name: "USP-S",
        type: "pistol",
        active: false,
        ammoClip: 12,
        ammoReserve: 24,
      },
      knife: { id: "knife", type: "knife", active: false },
    })
    expect(byName.Nova.equipment.activeWeapon?.id).toBe("m4a4")

    expect(byName.Ghost).toMatchObject({
      health: 12,
      armor: 0,
      money: 200,
      alive: true,
      side: "T",
      teamId: "redline",
    })
    expect(byName.Ghost.equipment.hasHelmet).toBe(false)
    expect(byName.Ghost.equipment.secondary?.id).toBe("glock")

    expect(byName.Sable.alive).toBe(false)
    expect(byName.Sable.health).toBe(0)
    expect(byName.Sable.equipment.primary).toBeUndefined()
    expect(byName.Sable.equipment.grenades).toEqual([])

    expect(byName.Viper.equipment.hasBomb).toBe(true)
    expect(byName.Viper.equipment.primary?.id).toBe("ak47")

    expect(byName.Drift.equipment.primary).toMatchObject({
      id: "awp",
      type: "sniper",
      active: true,
      ammoClip: 5,
      ammoReserve: 30,
    })

    expect(state.bomb).toEqual({
      state: "carried",
      carrierSteamId: "76561198000000004",
    })
  })

  test("observer steam id resolves to a roster player", async () => {
    const state = normalizeGsiPayload(await parsedFixture())
    const focused = state.players.find(
      (player) => player.steamId === state.observer.playerSteamId
    )
    expect(focused?.name).toBe("Nova")
  })

  test("missing optional data does not crash normalization", () => {
    const empty = parseGsiPayload({})
    expect(empty.success).toBe(true)
    if (!empty.success) {
      return
    }

    const state = normalizeGsiPayload(empty.data)
    expect(state).toEqual({
      timestamp: 0,
      map: { name: "", phase: "unknown", round: 0 },
      round: { phase: "unknown", winTeam: null },
      teams: [
        { id: "ct", name: "CT", side: "CT", score: 0 },
        { id: "t", name: "T", side: "T", score: 0 },
      ],
      players: [],
      observer: { playerSteamId: null },
      bomb: null,
    })

    const partial = parseGsiPayload({
      map: { name: "de_dust2", team_ct: { score: 1 } },
      round: {},
    })
    expect(partial.success).toBe(true)
    if (!partial.success) {
      return
    }

    const partialState = normalizeGsiPayload(partial.data)
    expect(partialState.map.name).toBe("de_dust2")
    expect(partialState.players).toEqual([])
    expect(partialState.bomb).toBeNull()
    expect(partialState.teams[0]?.score).toBe(1)
    expect(partialState.teams[1]?.score).toBe(0)
  })

  test("normalizes utility, defuse kit, bomb carrier, and bomb position", () => {
    const parsed = parseGsiPayload({
      player: { steamid: "ct1" },
      allplayers: {
        ct1: {
          name: "Nova",
          team: "CT",
          state: { health: 100, helmet: true, defusekit: true, armor: 100, money: 800 },
          weapons: {
            weapon_0: { name: "weapon_m4a1_silencer", type: "Rifle", state: "active", ammo_clip: 8, ammo_reserve: 40 },
            weapon_1: { name: "weapon_usp_silencer", type: "Pistol", state: "holstered", ammo_clip: 12, ammo_reserve: 24 },
            weapon_2: { name: "weapon_hegrenade", type: "Grenade", state: "holstered" },
            weapon_3: { name: "weapon_flashbang", type: "Grenade", ammo_reserve: 2, state: "holstered" },
            weapon_4: { name: "weapon_smokegrenade", type: "Grenade", state: "holstered" },
            weapon_5: { name: "weapon_incgrenade", type: "Grenade", state: "holstered" },
          },
        },
        t1: {
          name: "Viper",
          team: "T",
          state: { health: 80, helmet: true, money: 200 },
          weapons: {
            weapon_0: { name: "weapon_ak47", type: "Rifle", state: "holstered", ammo_clip: 30, ammo_reserve: 90 },
            weapon_1: { name: "weapon_c4", type: "C4", state: "active" },
            weapon_2: { name: "weapon_molotov", type: "Grenade", state: "holstered" },
            weapon_3: { name: "weapon_decoy", type: "Grenade", state: "holstered" },
          },
        },
      },
      bomb: {
        state: "carried",
        player: "t1",
        position: "100.5, 200, -3.25",
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    const state = normalizeGsiPayload(parsed.data)
    const nova = state.players.find((player) => player.name === "Nova")
    const viper = state.players.find((player) => player.name === "Viper")

    expect(state.observer.playerSteamId).toBe("ct1")
    expect(nova?.equipment.hasDefuseKit).toBe(true)
    expect(nova?.equipment.hasHelmet).toBe(true)
    expect(nova?.equipment.hasBomb).toBe(false)
    expect(nova?.equipment.primary?.id).toBe("m4a1_s")
    expect(nova?.equipment.secondary?.id).toBe("usp_s")
    expect(nova?.equipment.activeWeapon?.ammoClip).toBe(8)
    expect(nova?.equipment.grenades).toEqual([
      { id: "he", count: 1 },
      { id: "flash", count: 2 },
      { id: "smoke", count: 1 },
      { id: "incendiary", count: 1 },
    ])

    expect(viper?.equipment.hasBomb).toBe(true)
    expect(viper?.equipment.hasDefuseKit).toBe(false)
    expect(viper?.equipment.activeWeapon?.id).toBe("c4")
    expect(viper?.equipment.grenades).toEqual([
      { id: "molotov", count: 1 },
      { id: "decoy", count: 1 },
    ])
    expect(state.bomb).toEqual({
      state: "carried",
      carrierSteamId: "t1",
      position: { x: 100.5, y: 200, z: -3.25 },
    })
  })

  test("planted bomb is not treated as still carried", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        t1: {
          name: "Viper",
          team: "T",
          state: { health: 100 },
          weapons: {
            weapon_0: { name: "weapon_ak47", type: "Rifle", state: "active" },
          },
        },
      },
      bomb: { state: "planted", player: "t1", countdown: "29.4" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    const state = normalizeGsiPayload(parsed.data)
    expect(state.bomb).toEqual({ state: "planted", countdown: 29.4 })
    expect(state.players[0]?.equipment.hasBomb).toBe(false)
  })

  test("players without a weapons collection still normalize", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        ct1: { name: "Nova", team: "CT", state: { health: 40, helmet: false } },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.players[0]?.equipment).toEqual({
      grenades: [],
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
    })
  })
})
