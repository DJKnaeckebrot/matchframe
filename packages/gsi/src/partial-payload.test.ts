import { describe, expect, test } from "bun:test"
import { createGameStateEngine } from "@workspace/game-state"
import type { GameStateEngine, PlayerState } from "@workspace/game-state"

import { createGsiStateManager } from "./manager"
import type { GsiStateManager } from "./manager"
import { normalizeGsiPayload } from "./normalize"
import { parseGsiPayload } from "./parse"

const CT = "76561198000000001"
const T = "76561198000000002"

const novaWeapons = {
  weapon_0: {
    name: "weapon_m4a1",
    type: "Rifle",
    state: "active",
    ammo_clip: 25,
    ammo_reserve: 90,
  },
  weapon_1: {
    name: "weapon_usp_silencer",
    type: "Pistol",
    state: "holstered",
    ammo_clip: 12,
    ammo_reserve: 24,
  },
  weapon_2: {
    name: "weapon_flashbang",
    type: "Grenade",
    ammo_reserve: 2,
    state: "holstered",
  },
}

const viperWeapons = {
  weapon_0: {
    name: "weapon_ak47",
    type: "Rifle",
    state: "holstered",
    ammo_clip: 30,
    ammo_reserve: 90,
  },
  weapon_1: { name: "weapon_c4", type: "C4", state: "active" },
}

const initialPayload = {
  provider: { timestamp: 1000 },
  map: {
    name: "de_inferno",
    phase: "live",
    round: 14,
    team_ct: { name: "Northwind", score: 8 },
    team_t: { name: "Redline", score: 6 },
  },
  round: { phase: "live" },
  player: { steamid: CT, name: "Nova" },
  allplayers: {
    [CT]: {
      name: "Nova",
      team: "CT",
      state: { health: 100, armor: 100, helmet: true, money: 2700, defusekit: true },
      match_stats: { kills: 12, assists: 3, deaths: 8 },
      weapons: novaWeapons,
      position: "100, 200, 16",
      forward: "0, 1, 0",
    },
    [T]: {
      name: "Viper",
      team: "T",
      state: { health: 80, armor: 50, helmet: true, money: 200 },
      match_stats: { kills: 9, assists: 1, deaths: 10 },
      weapons: viperWeapons,
      position: "300, 400, 16",
      forward: "1, 0, 0",
    },
  },
  bomb: { state: "carried", player: T, position: "300, 400, 16" },
  grenades: {
    "291": { owner: CT, type: "smoke", lifetime: "10.5" },
  },
}

function ingest(
  gsi: GsiStateManager,
  engine: GameStateEngine,
  payload: unknown
) {
  gsi.update(payload)
  const parsed = parseGsiPayload(gsi.getState())
  expect(parsed.success).toBe(true)
  if (!parsed.success) {
    throw new Error("merged GSI failed Matchframe parse")
  }
  return engine.apply(normalizeGsiPayload(parsed.data))
}

function playerById(state: { players: readonly PlayerState[] }, steamId: string) {
  return state.players.find((player) => player.steamId === steamId)
}

describe("sequential GSI ingest", () => {
  test("full initial payload normalizes roster, weapons, and bomb", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    const { state } = ingest(gsi, engine, initialPayload)

    expect(state.map).toEqual({ name: "de_inferno", phase: "live", round: 14 })
    expect(state.teams.map((team) => team.score)).toEqual([8, 6])
    expect(state.players).toHaveLength(2)
    expect(state.observer.playerSteamId).toBe(CT)
    expect(state.bomb).toEqual({
      state: "carried",
      carrierSteamId: T,
      position: { x: 300, y: 400, z: 16 },
    })
    expect(playerById(state, CT)?.position).toEqual({ x: 100, y: 200, z: 16 })
    expect(playerById(state, T)?.forward).toEqual({ x: 1, y: 0, z: 0 })

    const nova = playerById(state, CT)
    expect(nova).toMatchObject({
      name: "Nova",
      health: 100,
      armor: 100,
      alive: true,
      money: 2700,
      kills: 12,
    })
    expect(nova?.equipment.primary?.id).toBe("m4a4")
    expect(nova?.equipment.grenades).toEqual([{ id: "flash", count: 2 }])
    expect(nova?.equipment.hasDefuseKit).toBe(true)
    expect(playerById(state, T)?.equipment.hasBomb).toBe(true)
  })

  test("health-only update keeps previous loadout and sibling fields", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: { state: { health: 47 } },
        [T]: {},
      },
    })

    const nova = playerById(state, CT)
    expect(nova?.health).toBe(47)
    expect(nova?.alive).toBe(true)
    expect(nova?.armor).toBe(100)
    expect(nova?.money).toBe(2700)
    expect(nova?.kills).toBe(12)
    expect(nova?.equipment.primary?.id).toBe("m4a4")
    expect(nova?.equipment.grenades).toEqual([{ id: "flash", count: 2 }])
    expect(playerById(state, T)?.health).toBe(80)
    expect(playerById(state, T)?.equipment.primary?.id).toBe("ak47")
  })

  test("weapon-only update keeps previous health and alive state", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: {
          weapons: {
            weapon_0: {
              name: "weapon_awp",
              type: "SniperRifle",
              state: "active",
              ammo_clip: 5,
              ammo_reserve: 30,
            },
            weapon_1: {
              name: "weapon_usp_silencer",
              type: "Pistol",
              state: "holstered",
              ammo_clip: 12,
              ammo_reserve: 24,
            },
          },
        },
        [T]: {},
      },
    })

    const nova = playerById(state, CT)
    expect(nova?.health).toBe(100)
    expect(nova?.alive).toBe(true)
    expect(nova?.equipment.primary?.id).toBe("awp")
    expect(nova?.equipment.grenades).toEqual([])
    expect(playerById(state, T)?.equipment.primary?.id).toBe("ak47")
  })

  test("omitted allplayers keeps roster, map, scores, and bomb", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, { provider: { timestamp: 1001 } })

    expect(state.timestamp).toBe(1001)
    expect(state.map.name).toBe("de_inferno")
    expect(state.map.round).toBe(14)
    expect(state.teams.map((team) => team.score)).toEqual([8, 6])
    expect(state.players).toHaveLength(2)
    expect(playerById(state, CT)?.equipment.primary?.id).toBe("m4a4")
    expect(playerById(state, CT)?.position).toEqual({ x: 100, y: 200, z: 16 })
    expect(state.bomb).toEqual({
      state: "carried",
      carrierSteamId: T,
      position: { x: 300, y: 400, z: 16 },
    })
  })

  test("present allplayers without a steam id removes that player without player_died", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state, events } = ingest(gsi, engine, {
      allplayers: {
        [CT]: {},
      },
    })

    expect(state.players.map((player) => player.steamId)).toEqual([CT])
    expect(events.filter((event) => event.type === "player_died")).toEqual([])
    expect(playerById(state, CT)?.health).toBe(100)
  })

  test("present weapons map drops a missing weapon key", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: {
          weapons: {
            weapon_0: novaWeapons.weapon_0,
            weapon_1: novaWeapons.weapon_1,
          },
        },
        [T]: {},
      },
    })

    expect(playerById(state, CT)?.equipment.primary?.id).toBe("m4a4")
    expect(playerById(state, CT)?.equipment.grenades).toEqual([])
  })

  test("weapons: {} empties that player's loadout", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: { weapons: {} },
        [T]: {},
      },
    })

    expect(playerById(state, CT)?.equipment).toEqual({
      grenades: [],
      hasHelmet: true,
      hasDefuseKit: true,
      hasBomb: false,
    })
    expect(playerById(state, T)?.equipment.primary?.id).toBe("ak47")
  })

  test("omitted bomb keeps a planted bomb", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    ingest(gsi, engine, {
      bomb: { state: "planted", countdown: "28.4" },
    })
    const { state } = ingest(gsi, engine, { provider: { timestamp: 1100 } })

    expect(state.timestamp).toBe(1100)
    expect(state.bomb).toMatchObject({
      state: "planted",
      countdown: 28.4,
      countdownDuration: 28.4,
    })
    expect(state.players).toHaveLength(2)
  })

  test("explicit bomb progress still updates Matchframe plant and defuse timers", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    ingest(gsi, engine, {
      bomb: { state: "planted", countdown: "28.4" },
    })
    const { state } = ingest(gsi, engine, {
      bomb: { state: "defusing", player: CT, countdown: "4.2" },
      phase_countdowns: { phase: "defuse", phase_ends_in: "4.2" },
    })

    expect(state.bomb).toEqual({
      state: "defusing",
      defuserSteamId: CT,
      position: { x: 300, y: 400, z: 16 },
      countdown: 28.4,
      countdownDuration: 28.4,
      defuseCountdown: 4.2,
      defuseDuration: 4.2,
    })
  })

  test("omitted map keeps previous name, scores, and round", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      round: { phase: "live" },
      allplayers: {
        [CT]: { state: { health: 90 } },
        [T]: {},
      },
    })

    expect(state.map).toEqual({ name: "de_inferno", phase: "live", round: 14 })
    expect(state.teams.map((team) => team.score)).toEqual([8, 6])
    expect(playerById(state, CT)?.health).toBe(90)
  })

  test("omitted world grenades stay; present map prunes missing keys", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)

    ingest(gsi, engine, { provider: { timestamp: 1002 } })
    const kept = gsi.getState() as { grenades?: Record<string, unknown> }
    expect(kept.grenades).toHaveProperty("291")

    ingest(gsi, engine, {
      grenades: {
        "354": { owner: T, type: "flashbang", lifetime: "1.2" },
      },
    })
    const pruned = gsi.getState() as { grenades?: Record<string, unknown> }
    expect(pruned.grenades).not.toHaveProperty("291")
    expect(pruned.grenades).toHaveProperty("354")
  })

  test("previously, added, and auth never enter merged raw or GameState", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      auth: { token: "secret" },
      previously: { player: { state: { health: 100 } } },
      added: { bomb: true },
      allplayers: {
        [CT]: { state: { health: 10 } },
        [T]: {},
      },
    })

    const raw = gsi.getState() as Record<string, unknown>
    expect(raw).not.toHaveProperty("auth")
    expect(raw).not.toHaveProperty("previously")
    expect(raw).not.toHaveProperty("added")
    expect(JSON.stringify(state)).not.toContain("secret")
    expect(playerById(state, CT)?.health).toBe(10)
  })

  test("one-player position update keeps the sibling player's position", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: { position: "150, 200, 16" },
        [T]: {},
      },
    })

    expect(playerById(state, CT)?.position).toEqual({ x: 150, y: 200, z: 16 })
    expect(playerById(state, CT)?.forward).toEqual({ x: 0, y: 1, z: 0 })
    expect(playerById(state, T)?.position).toEqual({ x: 300, y: 400, z: 16 })
    expect(playerById(state, T)?.forward).toEqual({ x: 1, y: 0, z: 0 })
  })

  test("omitted allplayers keeps every player position", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, { provider: { timestamp: 1003 } })

    expect(playerById(state, CT)?.position).toEqual({ x: 100, y: 200, z: 16 })
    expect(playerById(state, T)?.position).toEqual({ x: 300, y: 400, z: 16 })
  })

  test("present allplayers without a steam id drops that player's position with the player", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: { position: "100, 200, 16" },
      },
    })

    expect(state.players.map((player) => player.steamId)).toEqual([CT])
    expect(playerById(state, CT)?.position).toEqual({ x: 100, y: 200, z: 16 })
    expect(playerById(state, T)).toBeUndefined()
  })

  test("stale defusekit after a side switch does not show a kit on T", () => {
    const gsi = createGsiStateManager()
    const engine = createGameStateEngine()
    ingest(gsi, engine, initialPayload)
    const { state } = ingest(gsi, engine, {
      allplayers: {
        [CT]: { team: "T" },
        [T]: { team: "CT" },
      },
    })

    const raw = gsi.getState() as {
      allplayers?: Record<string, { state?: { defusekit?: boolean }; team?: string }>
    }
    expect(raw.allplayers?.[CT]?.team).toBe("T")
    expect(raw.allplayers?.[CT]?.state?.defusekit).toBe(true)
    expect(playerById(state, CT)?.side).toBe("T")
    expect(playerById(state, CT)?.equipment.hasDefuseKit).toBe(false)
    expect(playerById(state, T)?.side).toBe("CT")
    expect(playerById(state, T)?.equipment.hasDefuseKit).toBe(false)
  })
})
