import { describe, expect, test } from "bun:test"
import type { PlayerState } from "@workspace/game-state"

import { observerSlotLabel, playersForTeam, rosterNumber } from "./format"

function player(
  partial: Partial<PlayerState> & Pick<PlayerState, "steamId" | "teamId" | "side">
): PlayerState {
  return {
    name: partial.name ?? partial.steamId,
    alive: true,
    health: 100,
    armor: 100,
    money: 0,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: {
      grenades: [],
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
    },
    ...partial,
  }
}

describe("observerSlotLabel", () => {
  test("maps GSI 0 to keyboard 10", () => {
    expect(observerSlotLabel(0)).toBe(10)
  })

  test("keeps slots 1–10", () => {
    expect(observerSlotLabel(1)).toBe(1)
    expect(observerSlotLabel(10)).toBe(10)
  })

  test("drops missing and out-of-range values", () => {
    expect(observerSlotLabel(undefined)).toBeUndefined()
    expect(observerSlotLabel(-1)).toBeUndefined()
    expect(observerSlotLabel(11)).toBeUndefined()
  })
})

describe("playersForTeam", () => {
  test("sorts by keyboard slot and pads to five", () => {
    const slots = playersForTeam(
      [
        player({ steamId: "c", teamId: "ct", side: "CT", name: "Quill", observerSlot: 5 }),
        player({ steamId: "a", teamId: "ct", side: "CT", name: "Nova", observerSlot: 1 }),
        player({ steamId: "t", teamId: "t", side: "T", name: "Viper", observerSlot: 6 }),
        player({ steamId: "b", teamId: "ct", side: "CT", name: "Ash", observerSlot: 0 }),
      ],
      "ct"
    )
    expect(slots.map((slot) => slot?.name ?? null)).toEqual([
      "Nova",
      "Quill",
      "Ash",
      null,
      null,
    ])
  })
})

describe("rosterNumber", () => {
  test("is 1-based team-view order, not the keyboard slot", () => {
    const players = [
      player({ steamId: "t1", teamId: "t", side: "T", name: "Viper", observerSlot: 6 }),
      player({ steamId: "t2", teamId: "t", side: "T", name: "Pike", observerSlot: 0 }),
      player({ steamId: "ct1", teamId: "ct", side: "CT", name: "Nova", observerSlot: 1 }),
    ]
    expect(rosterNumber(players, "t", "t1")).toBe(1)
    expect(rosterNumber(players, "t", "t2")).toBe(2)
    expect(rosterNumber(players, "ct", "ct1")).toBe(1)
    expect(rosterNumber(players, "ct", "t1")).toBeUndefined()
  })
})
