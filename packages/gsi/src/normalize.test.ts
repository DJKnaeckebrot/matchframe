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
    expect(state.observer.steamId).toBe("76561198000000001")

    expect(byName.Nova).toMatchObject({
      steamId: "76561198000000001",
      teamId: "northwind",
      side: "CT",
      alive: true,
      health: 100,
      armor: 100,
      helmet: true,
      money: 2700,
      kills: 12,
      assists: 3,
      deaths: 8,
    })
    expect(byName.Nova.weapons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "weapon_m4a1",
          type: "Rifle",
          state: "active",
          ammoClip: 25,
          ammoReserve: 90,
        }),
      ])
    )

    expect(byName.Ghost).toMatchObject({
      health: 12,
      armor: 0,
      helmet: false,
      money: 200,
      alive: true,
      side: "T",
      teamId: "redline",
    })

    expect(byName.Sable.alive).toBe(false)
    expect(byName.Sable.health).toBe(0)
    expect(byName.Sable.weapons).toEqual([])

    expect(state.bomb).toEqual({
      state: "carried",
      playerSteamId: "76561198000000004",
      countdown: null,
    })
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
      observer: { steamId: null },
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
})
