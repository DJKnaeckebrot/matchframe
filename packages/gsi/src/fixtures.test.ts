import { describe, expect, test } from "bun:test"
import { createGameStateEngine } from "@workspace/game-state"

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
    expect(state.players.every((player) => player.health === 100 && player.alive)).toBe(true)
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
})
