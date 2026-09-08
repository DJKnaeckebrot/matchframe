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

    expect(state.map).toMatchObject({
      name: "de_inferno",
      phase: "live",
      round: 14,
    })
    expect(state.map.roundHistory).toHaveLength(14)
    expect(state.map.roundHistory[0]).toEqual({
      round: 1,
      winner: "CT",
      reason: "elimination",
    })
    expect(state.map.roundHistory[13]).toEqual({
      round: 14,
      winner: "CT",
      reason: "elimination",
    })
  })

  test("produces the expected team scores", async () => {
    const state = normalizeGsiPayload(await parsedFixture())

    expect(state.teams).toEqual([
      { id: "northwind", name: "Northwind", side: "CT", score: 8, seriesWins: 0 },
      { id: "redline", name: "Redline", side: "T", score: 6, seriesWins: 0 },
    ])
  })

  test("copies matches won this series onto logical teams", () => {
    const parsed = parseGsiPayload({
      map: {
        team_ct: { name: "Northwind", score: 8, matches_won_this_series: 1 },
        team_t: { name: "Redline", score: 6, matches_won_this_series: 2 },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeGsiPayload(parsed.data).teams.map((team) => [team.name, team.seriesWins])).toEqual([
      ["Northwind", 1],
      ["Redline", 2],
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
      map: { name: "", phase: "unknown", round: 0, roundHistory: [] },
      round: { phase: "unknown", winTeam: null, alive: { ct: 0, t: 0 } },
      teams: [
        { id: "ct", name: "CT", side: "CT", score: 0, seriesWins: 0 },
        { id: "t", name: "T", side: "T", score: 0, seriesWins: 0 },
      ],
      players: [],
      observer: { playerSteamId: null },
      bomb: null,
      pause: null,
      worldGrenades: [],
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

  test("T players never keep a defuse kit, even when GSI still reports one", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        t1: {
          name: "Viper",
          team: "T",
          state: { health: 100, helmet: true, defusekit: true, armor: 100, money: 800 },
        },
        ct1: {
          name: "Nova",
          team: "CT",
          state: { health: 100, helmet: true, defusekit: true, armor: 100, money: 800 },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.players.find((player) => player.name === "Viper")?.equipment.hasDefuseKit).toBe(
      false
    )
    expect(state.players.find((player) => player.name === "Nova")?.equipment.hasDefuseKit).toBe(
      true
    )
  })

  test("parses player position and forward; invalid vectors stay undefined", () => {
    const parsed = parseGsiPayload({
      allplayers: {
        ct1: {
          name: "Nova",
          team: "CT",
          state: { health: 100 },
          position: "-2796, 3328, 16",
          forward: "0, 1, 0.05",
        },
        t1: {
          name: "Viper",
          team: "T",
          state: { health: 100 },
          position: "not-a-vector",
          forward: "1, 0",
        },
        t2: {
          name: "Ghost",
          team: "T",
          state: { health: 100 },
        },
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    const state = normalizeGsiPayload(parsed.data)
    const nova = state.players.find((player) => player.name === "Nova")
    const viper = state.players.find((player) => player.name === "Viper")
    const ghost = state.players.find((player) => player.name === "Ghost")

    expect(nova?.position).toEqual({ x: -2796, y: 3328, z: 16 })
    expect(nova?.forward).toEqual({ x: 0, y: 1, z: 0.05 })
    expect(viper?.position).toBeUndefined()
    expect(viper?.forward).toBeUndefined()
    expect(ghost?.position).toBeUndefined()
    expect(ghost?.forward).toBeUndefined()
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

  test("live fixture exposes round clock and side alive counts", async () => {
    const state = normalizeGsiPayload(await parsedFixture())
    expect(state.round.phase).toBe("live")
    expect(state.round.timeRemaining).toBe(83.4)
    expect(state.round.alive).toEqual({ ct: 3, t: 2 })
    expect(state.round.winTeam).toBeNull()
    expect(state.pause).toBeNull()
  })

  test("round phase and freeze countdown come from GSI, not invented clocks", () => {
    const parsed = parseGsiPayload({
      round: { phase: "freezetime" },
      phase_countdowns: { phase: "freezetime", phase_ends_in: "12.0" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.round.phase).toBe("freezetime")
    expect(state.round.timeRemaining).toBe(12)
  })

  test("missing countdown stays undefined", () => {
    const parsed = parseGsiPayload({
      round: { phase: "live" },
      bomb: { state: "carried", player: "t1" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.round.timeRemaining).toBeUndefined()
    expect(state.bomb?.countdown).toBeUndefined()
  })

  test("phase_countdowns bomb timer is not copied onto the round clock", () => {
    const parsed = parseGsiPayload({
      round: { phase: "live" },
      phase_countdowns: { phase: "bomb", phase_ends_in: "28.4" },
      bomb: { state: "planted", countdown: "28.4" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.round.phase).toBe("live")
    expect(state.round.timeRemaining).toBeUndefined()
    expect(state.bomb).toEqual({ state: "planted", countdown: 28.4 })
  })

  test("carried and dropped bombs never keep a planted countdown", () => {
    for (const bomb of [
      { state: "carried" as const, player: "t1", countdown: "40" },
      { state: "dropped" as const, countdown: "40" },
    ]) {
      const parsed = parseGsiPayload({ bomb })
      expect(parsed.success).toBe(true)
      if (!parsed.success) {
        continue
      }
      const state = normalizeGsiPayload(parsed.data)
      expect(state.bomb?.countdown).toBeUndefined()
      expect(state.bomb?.state).toBe(bomb.state)
    }
  })

  test("defusing is planted-adjacent but does not reuse the defuse timer as a plant countdown", () => {
    const parsed = parseGsiPayload({
      bomb: { state: "defusing", player: "ct1", countdown: "4.2" },
      phase_countdowns: { phase: "defuse", phase_ends_in: "4.2" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.bomb).toEqual({
      state: "defusing",
      defuserSteamId: "ct1",
      defuseCountdown: 4.2,
    })
    expect(state.bomb?.countdown).toBeUndefined()
    expect(state.round.timeRemaining).toBeUndefined()
  })

  test("defusing without bomb.player leaves defuserSteamId unset", () => {
    const parsed = parseGsiPayload({
      bomb: { state: "defusing", countdown: "3.1" },
      phase_countdowns: { phase: "defuse", phase_ends_in: "3.1" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.bomb).toEqual({ state: "defusing", defuseCountdown: 3.1 })
    expect(state.bomb?.defuserSteamId).toBeUndefined()
  })

  test("defused and exploded bombs drop countdown and carrier", () => {
    for (const bombState of ["defused", "exploded"] as const) {
      const parsed = parseGsiPayload({
        bomb: { state: bombState, player: "t1", countdown: "0.8" },
      })
      expect(parsed.success).toBe(true)
      if (!parsed.success) {
        continue
      }
      const state = normalizeGsiPayload(parsed.data)
      expect(state.bomb).toEqual({ state: bombState })
    }
  })

  test("alive counts follow current side, including after a switch", () => {
    const payload = {
      map: {
        team_ct: { name: "Northwind" },
        team_t: { name: "Redline" },
      },
      allplayers: {
        ct1: { team: "CT", state: { health: 100 } },
        ct2: { team: "CT", state: { health: 100 } },
        ct3: { team: "CT", state: { health: 0 } },
        t1: { team: "T", state: { health: 80 } },
        t2: { team: "T", state: { health: 0 } },
      },
    }
    const live = parseGsiPayload(payload)
    expect(live.success).toBe(true)
    if (!live.success) {
      return
    }
    expect(normalizeGsiPayload(live.data).round.alive).toEqual({ ct: 2, t: 1 })

    const swapped = parseGsiPayload({
      map: {
        team_ct: { name: "Redline" },
        team_t: { name: "Northwind" },
      },
      allplayers: {
        ct1: { team: "T", state: { health: 100 } },
        ct2: { team: "T", state: { health: 100 } },
        ct3: { team: "T", state: { health: 0 } },
        t1: { team: "CT", state: { health: 80 } },
        t2: { team: "CT", state: { health: 0 } },
      },
    })
    expect(swapped.success).toBe(true)
    if (!swapped.success) {
      return
    }
    expect(normalizeGsiPayload(swapped.data).round.alive).toEqual({ ct: 1, t: 2 })
  })

  test("round winner and win reason are normalized without Valve strings", () => {
    const parsed = parseGsiPayload({
      map: { round: 14, round_wins: { "15": "ct_win_defuse" } },
      round: { phase: "over", win_team: "CT", bomb: "defused" },
      phase_countdowns: { phase: "over", phase_ends_in: "6" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    const state = normalizeGsiPayload(parsed.data)
    expect(state.round).toMatchObject({
      phase: "over",
      winTeam: "CT",
      winReason: "bomb_defused",
      timeRemaining: 6,
    })
    expect(state.map.roundHistory).toEqual([
      { round: 15, winner: "CT", reason: "bomb_defused" },
    ])
  })

  test("round_wins become a sorted history of sides and reasons", () => {
    const parsed = parseGsiPayload({
      map: {
        round: 3,
        round_wins: {
          "2": "t_win_bomb",
          "1": "ct_win_elimination",
          "3": "ct_win_time",
          nope: "ct_win_defuse",
        },
      },
      round: { phase: "live" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeGsiPayload(parsed.data).map.roundHistory).toEqual([
      { round: 1, winner: "CT", reason: "elimination" },
      { round: 2, winner: "T", reason: "bomb_exploded" },
      { round: 3, winner: "CT", reason: "time_expired" },
    ])
  })

  test("round over without round_wins still appends the current winner", () => {
    const parsed = parseGsiPayload({
      map: { round: 0 },
      round: { phase: "over", win_team: "T", bomb: "exploded" },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }
    expect(normalizeGsiPayload(parsed.data).map.roundHistory).toEqual([
      { round: 1, winner: "T", reason: "bomb_exploded" },
    ])
  })

  test("pause and timeout come from phase_countdowns only", () => {
    const paused = parseGsiPayload({
      round: { phase: "live" },
      phase_countdowns: { phase: "paused", phase_ends_in: "45.0" },
    })
    expect(paused.success).toBe(true)
    if (!paused.success) {
      return
    }
    expect(normalizeGsiPayload(paused.data).pause).toEqual({
      kind: "paused",
      timeRemaining: 45,
    })

    const timeout = parseGsiPayload({
      round: { phase: "live" },
      phase_countdowns: { phase: "timeout_t", phase_ends_in: "30" },
    })
    expect(timeout.success).toBe(true)
    if (!timeout.success) {
      return
    }
    expect(normalizeGsiPayload(timeout.data).pause).toEqual({
      kind: "timeout",
      side: "T",
      timeRemaining: 30,
    })
  })
})
