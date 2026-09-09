import { describe, expect, test } from "bun:test"
import { createGameStateEngine, getDisplayRoundNumber } from "@workspace/game-state"

import { loadGsiFixture } from "./fixtures"
import { normalizeGsiPayload } from "./normalize"
import { parseGsiPayload } from "./parse"
import type { GsiFixtureVariant } from "./fixtures"

async function normalized(variant: GsiFixtureVariant) {
  const parsed = parseGsiPayload(await loadGsiFixture(variant))
  if (!parsed.success) {
    throw new Error("fixture failed to parse")
  }
  return normalizeGsiPayload(parsed.data)
}

describe("GSI fixture variants", () => {
  test("healthy fixture restores full health", async () => {
    const state = await normalized("healthy")
    expect(state.players).toHaveLength(10)
    expect(state.players.every((player) => player.observerSlot !== undefined)).toBe(true)
    expect(state.players.every((player) => player.health === 100 && player.alive)).toBe(true)
    expect(state.round.alive).toEqual({ ct: 5, t: 5 })
  })

  test("dead fixture includes a dead player", async () => {
    const state = await normalized("dead")
    expect(state.players.some((player) => !player.alive)).toBe(true)
  })

  test("sides-switched moves Northwind onto T", async () => {
    const state = await normalized("sides-switched")
    const northwind = state.teams.find((team) => team.name === "Northwind")
    const nova = state.players.find((player) => player.name === "Nova")
    expect(northwind?.side).toBe("T")
    expect(nova?.side).toBe("T")
  })

  test("series fixture reports map wins on logical teams", async () => {
    const state = await normalized("series")
    expect(state.teams.map((team) => [team.name, team.seriesWins])).toEqual([
      ["Northwind", 1],
      ["Redline", 0],
    ])
  })

  test("logical teams keep left/right order after a fixture side switch", async () => {
    const engine = createGameStateEngine()
    const live = engine.apply(await normalized("live"))
    const swapped = engine.apply(await normalized("sides-switched"))

    expect(live.state.teams.map((team) => team.name)).toEqual(["Northwind", "Redline"])
    expect(swapped.state.teams.map((team) => [team.name, team.side])).toEqual([
      ["Northwind", "T"],
      ["Redline", "CT"],
    ])
  })

  test("equipment fixture covers rifle, AWP, utility, bomb, kit, low ammo, and a dead player", async () => {
    const state = await normalized("equipment")
    const byName = Object.fromEntries(state.players.map((player) => [player.name, player]))

    expect(byName.Nova.equipment.primary?.id).toBe("m4a1_s")
    expect(byName.Nova.equipment.hasDefuseKit).toBe(true)
    expect(byName.Nova.equipment.grenades).toEqual([
      { id: "he", count: 1 },
      { id: "flash", count: 2 },
      { id: "smoke", count: 1 },
    ])
    expect(byName.Drift.equipment.primary).toMatchObject({
      id: "awp",
      ammoClip: 1,
      ammoReserve: 5,
    })
    expect(byName.Viper.equipment.hasBomb).toBe(true)
    expect(byName.Ghost.equipment.secondary).toMatchObject({ ammoClip: 4, ammoReserve: 0 })
    expect(byName.Sable.alive).toBe(false)
    expect(state.bomb?.carrierSteamId).toBe("76561198000000004")
  })

  test("observer fixture focuses a different roster player", async () => {
    const live = await normalized("live")
    const observed = await normalized("observer")
    expect(live.observer.playerSteamId).toBe("76561198000000001")
    expect(observed.observer.playerSteamId).toBe("76561198000000004")
    expect(
      observed.players.some((player) => player.steamId === observed.observer.playerSteamId)
    ).toBe(true)
  })

  test("freeze fixture is freezetime with a clock", async () => {
    const state = await normalized("freeze")
    expect(state.round.phase).toBe("freezetime")
    expect(state.round.timeRemaining).toBe(12)
    expect(state.players.every((player) => player.alive)).toBe(true)
    expect(state.map.roundHistory).toHaveLength(14)
    expect(state.map.roundHistory.filter((entry) => entry.winner === "CT")).toHaveLength(8)
    expect(state.map.roundHistory.filter((entry) => entry.winner === "T")).toHaveLength(6)
  })

  test("4v5 and 1v2 fixtures set alive counts by current side", async () => {
    expect((await normalized("4v5")).round.alive).toEqual({ ct: 4, t: 5 })
    expect((await normalized("1v2")).round.alive).toEqual({ ct: 1, t: 2 })
  })

  test("bomb-planted and bomb-low-time expose planted countdown", async () => {
    const planted = await normalized("bomb-planted")
    expect(planted.bomb).toEqual({ state: "planted", countdown: 28.4 })
    expect(planted.round.timeRemaining).toBeUndefined()

    const low = await normalized("bomb-low-time")
    expect(low.bomb).toEqual({ state: "planted", countdown: 5.2 })
  })

  test("bomb-defusing uses the defuse timer, not plant remaining", async () => {
    const state = await normalized("bomb-defusing")
    expect(state.bomb).toMatchObject({
      state: "defusing",
      defuseCountdown: 4.2,
      defuserSteamId: "76561198000000001",
    })
    expect(state.bomb?.countdown).toBeUndefined()
    expect(state.round.timeRemaining).toBeUndefined()

    const low = await normalized("bomb-defusing-low-time")
    expect(low.bomb).toMatchObject({ state: "defusing", defuseCountdown: 1.1 })
  })

  test("bomb-defused and bomb-exploded clear plant progress", async () => {
    const defused = await normalized("bomb-defused")
    expect(defused.bomb?.state).toBe("defused")
    expect(defused.round.winReason).toBe("bomb_defused")

    const exploded = await normalized("bomb-exploded")
    expect(exploded.bomb?.state).toBe("exploded")
    expect(exploded.round.winReason).toBe("bomb_exploded")
  })

  test("planted then defusing fixtures preserve bomb remaining through the engine", async () => {
    const engine = createGameStateEngine()
    const planted = engine.apply(await normalized("bomb-planted"))
    expect(planted.state.bomb).toMatchObject({
      state: "planted",
      countdown: 28.4,
      countdownDuration: 28.4,
    })

    const defusing = engine.apply(await normalized("bomb-defusing"))
    expect(defusing.state.bomb).toMatchObject({
      state: "defusing",
      countdown: 28.4,
      countdownDuration: 28.4,
      defuseCountdown: 4.2,
      defuseDuration: 4.2,
    })
  })

  test("sides-switched bomb fixtures keep logical order after a live snapshot", async () => {
    const engine = createGameStateEngine()
    engine.apply(await normalized("live"))
    const planted = engine.apply(await normalized("sides-switched-bomb-planted"))
    expect(planted.state.teams.map((team) => [team.name, team.side])).toEqual([
      ["Northwind", "T"],
      ["Redline", "CT"],
    ])
    expect(planted.state.bomb).toMatchObject({ state: "planted", countdown: 28.4 })

    const defusing = engine.apply(await normalized("sides-switched-defusing"))
    expect(defusing.state.teams.map((team) => [team.name, team.side])).toEqual([
      ["Northwind", "T"],
      ["Redline", "CT"],
    ])
    expect(defusing.state.bomb).toMatchObject({
      state: "defusing",
      countdown: 28.4,
      defuseCountdown: 4.2,
    })
  })

  test("round result fixtures", async () => {
    const ctWin = await normalized("round-ct-win")
    expect(ctWin.round).toMatchObject({
      phase: "over",
      winTeam: "CT",
      winReason: "elimination",
    })

    const tWin = await normalized("round-t-win")
    expect(tWin.round).toMatchObject({ phase: "over", winTeam: "T", winReason: "elimination" })

    const defused = await normalized("round-over-bomb-defused")
    expect(defused.round).toMatchObject({
      phase: "over",
      winTeam: "CT",
      winReason: "bomb_defused",
    })
    expect(defused.bomb?.state).toBe("defused")
  })

  test("sides-switched-live keeps live clock while swapping sides", async () => {
    const state = await normalized("sides-switched-live")
    const northwind = state.teams.find((team) => team.name === "Northwind")
    expect(northwind?.side).toBe("T")
    expect(state.round.phase).toBe("live")
    expect(state.round.timeRemaining).toBe(83.4)
  })

  test("display round is 1-based while map.round stays the GSI index", async () => {
    const live = await normalized("live")
    expect(live.map.round).toBe(14)
    expect(getDisplayRoundNumber(live)).toBe(15)

    const over = await normalized("round-ct-win")
    expect(over.map.round).toBe(14)
    expect(getDisplayRoundNumber(over)).toBe(15)

    const freeze = await normalized("freeze")
    expect(freeze.map.round).toBe(14)
    expect(getDisplayRoundNumber(freeze)).toBe(15)

    const swapped = await normalized("sides-switched-live")
    expect(swapped.map.round).toBe(14)
    expect(getDisplayRoundNumber(swapped)).toBe(15)
    expect(swapped.teams.find((team) => team.name === "Northwind")?.side).toBe("T")
  })

  test("radar-anubis fixture uses overview spawn positions", async () => {
    const state = await normalized("radar-anubis")
    expect(state.map.name).toBe("de_anubis")
    const nova = state.players.find((player) => player.name === "Nova")
    const viper = state.players.find((player) => player.name === "Viper")
    const sable = state.players.find((player) => player.name === "Sable")
    expect(nova?.position).toEqual({ x: -2796 + 0.61 * 5.22 * 1024, y: 3328 - 0.22 * 5.22 * 1024, z: 0 })
    expect(nova?.forward).toEqual({ x: 0, y: 1, z: 0 })
    expect(viper?.position).toEqual({ x: -2796 + 0.58 * 5.22 * 1024, y: 3328 - 0.93 * 5.22 * 1024, z: 0 })
    expect(sable?.alive).toBe(false)
    expect(sable?.position).toBeDefined()
    expect(state.bomb?.state).toBe("carried")
  })

  test("radar-anubis-moved only shifts Nova east", async () => {
    const live = await normalized("radar-anubis")
    const moved = await normalized("radar-anubis-moved")
    const liveNova = live.players.find((player) => player.name === "Nova")
    const movedNova = moved.players.find((player) => player.name === "Nova")
    const liveViper = live.players.find((player) => player.name === "Viper")
    const movedViper = moved.players.find((player) => player.name === "Viper")
    expect(movedNova?.position?.x).toBeCloseTo((liveNova?.position?.x ?? 0) + 0.1 * 5.22 * 1024, 5)
    expect(movedNova?.position?.y).toBe(liveNova?.position?.y)
    expect(movedViper?.position).toEqual(liveViper?.position)
  })

  test("radar bomb fixtures expose dropped and planted positions", async () => {
    const dropped = await normalized("radar-anubis-bomb-dropped")
    const planted = await normalized("radar-anubis-bomb-planted")
    expect(dropped.bomb).toMatchObject({
      state: "dropped",
      position: { x: -2796 + 0.58 * 5.22 * 1024, y: 3328 - 0.93 * 5.22 * 1024, z: 0 },
    })
    expect(planted.bomb).toMatchObject({
      state: "planted",
      countdown: 28.4,
      position: { x: -2796 + 0.61 * 5.22 * 1024, y: 3328 - 0.22 * 5.22 * 1024, z: 0 },
    })
  })

  test("radar smoke fixtures expose in-flight, active, two, and cleared collections", async () => {
    const flight = await normalized("radar-anubis-smoke-flight")
    expect(flight.worldGrenades).toHaveLength(1)
    expect(flight.worldGrenades[0]).toMatchObject({
      id: "401",
      type: "smoke",
      ownerSteamId: "76561198000000004",
      effectTime: 0,
    })
    expect(flight.worldGrenades[0]?.velocity).toEqual({ x: 40, y: 280, z: 20 })

    const moved = await normalized("radar-anubis-smoke-flight-moved")
    expect(moved.worldGrenades[0]?.id).toBe("401")
    expect(moved.worldGrenades[0]?.position?.y).not.toBe(flight.worldGrenades[0]?.position?.y)
    expect(moved.worldGrenades[0]?.effectTime).toBe(0)

    const active = await normalized("radar-anubis-smoke-active")
    expect(active.worldGrenades[0]).toMatchObject({
      id: "401",
      type: "smoke",
      effectTime: 2.1,
    })

    const two = await normalized("radar-anubis-two-smokes")
    expect(two.worldGrenades.map((grenade) => grenade.id)).toEqual(["401", "402"])
    expect(two.worldGrenades.every((grenade) => grenade.type === "smoke")).toBe(true)
    expect(two.worldGrenades[0]?.position).not.toEqual(two.worldGrenades[1]?.position)

    const removed = await normalized("radar-anubis-smoke-removed")
    expect(removed.worldGrenades).toEqual([])
  })

  test("radar grenade fixtures expose HE, flash, decoy, fire, inferno, mixed, and cleared", async () => {
    const he = await normalized("radar-he-flight")
    expect(he.worldGrenades).toEqual([
      expect.objectContaining({
        id: "501",
        type: "he",
        ownerSteamId: "76561198000000004",
      }),
    ])
    expect(he.worldGrenades[0]?.flames).toBeUndefined()

    const flash = await normalized("radar-flash-flight")
    expect(flash.worldGrenades[0]).toMatchObject({ id: "502", type: "flash" })

    const decoy = await normalized("radar-decoy-active")
    expect(decoy.worldGrenades[0]).toMatchObject({ id: "503", type: "decoy" })

    const fire = await normalized("radar-fire-flight")
    expect(fire.worldGrenades[0]).toMatchObject({
      id: "504",
      type: "molotov",
      ownerSteamId: "76561198000000004",
    })
    expect(fire.worldGrenades[0]?.flames).toBeUndefined()

    const inferno = await normalized("radar-inferno-active")
    expect(inferno.worldGrenades[0]?.type).toBe("molotov")
    expect(inferno.worldGrenades[0]?.flames?.length).toBe(4)

    const molotov = await normalized("radar-anubis-molotov-active")
    expect(molotov.worldGrenades[0]?.type).toBe("molotov")
    expect(molotov.worldGrenades[0]?.flames?.length).toBe(10)
    expect(molotov.worldGrenades[0]?.flames).toEqual(
      (await normalized("radar-inferno-multi-flame")).worldGrenades[0]?.flames
    )

    const flight = await normalized("radar-anubis-molotov-flight")
    expect(flight.worldGrenades[0]).toMatchObject({
      id: "504",
      type: "molotov",
    })
    expect(flight.worldGrenades[0]?.flames).toBeUndefined()

    const incendiary = await normalized("radar-anubis-incendiary-active")
    expect(incendiary.worldGrenades[0]).toMatchObject({
      id: "506",
      type: "incendiary",
      ownerSteamId: "76561198000000001",
    })
    expect(incendiary.worldGrenades[0]?.flames?.length).toBe(7)

    const two = await normalized("radar-anubis-molotov-two-areas")
    expect(two.worldGrenades.map((grenade) => grenade.id)).toEqual(["505", "506"])
    expect(two.worldGrenades[0]?.flames?.length).toBe(10)
    expect(two.worldGrenades[1]?.type).toBe("incendiary")
    expect(two.worldGrenades[0]?.position).not.toEqual(two.worldGrenades[1]?.position)

    const removed = await normalized("radar-anubis-molotov-removed")
    expect(removed.worldGrenades).toEqual([])

    const multi = await normalized("radar-inferno-multi-flame")
    expect(multi.worldGrenades[0]?.flames?.length).toBe(10)
    expect(multi.worldGrenades[0]?.flames?.[0]).not.toEqual(multi.worldGrenades[0]?.flames?.[9])

    const mixed = await normalized("radar-grenades-mixed")
    expect(mixed.worldGrenades.map((grenade) => grenade.type)).toEqual([
      "smoke",
      "he",
      "flash",
      "decoy",
      "molotov",
    ])
    expect(mixed.worldGrenades.find((grenade) => grenade.id === "505")?.flames?.length).toBe(10)

    const cleared = await normalized("radar-grenades-cleared")
    expect(cleared.worldGrenades).toEqual([])
  })
})
