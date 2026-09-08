import { describe, expect, test } from "bun:test"
import type { GameState, RoundHistoryEntry } from "@workspace/game-state"

import { roundHistoryTrack } from "./round-history"

function state(
  round: number,
  history: readonly RoundHistoryEntry[] = [],
  phase: GameState["round"]["phase"] = "freezetime"
): GameState {
  return {
    timestamp: 1,
    map: { name: "de_inferno", phase: "live", round, roundHistory: history },
    round: { phase, winTeam: null, alive: { ct: 5, t: 5 } },
    teams: [
      { id: "northwind", name: "Northwind", side: "CT", score: 0, seriesWins: 0 },
      { id: "redline", name: "Redline", side: "T", score: 0, seriesWins: 0 },
    ],
    players: [],
    observer: { playerSteamId: null },
    bomb: null,
    pause: null,
    worldGrenades: [],
  }
}

describe("roundHistoryTrack", () => {
  test("regulation freeze is 24 empty slots with a half splice", () => {
    const track = roundHistoryTrack(state(0))
    expect(track.overtime).toBeNull()
    expect(track.labels).toEqual([6, 12, 18, 24])
    expect(track.halves[0]).toHaveLength(12)
    expect(track.halves[1]).toHaveLength(12)
    expect(track.halves[0][0]).toEqual({ round: 1, current: true })
    expect(track.halves[1][11]).toEqual({ round: 24, current: false })
  })

  test("fills completed rounds and marks the live display round", () => {
    const track = roundHistoryTrack(
      state(7, [
        { round: 1, winner: "CT", reason: "elimination" },
        { round: 2, winner: "T", reason: "bomb_exploded" },
      ])
    )
    expect(track.halves[0][0]).toEqual({
      round: 1,
      winner: "CT",
      reason: "elimination",
      current: false,
    })
    expect(track.halves[0][1]).toEqual({
      round: 2,
      winner: "T",
      reason: "bomb_exploded",
      current: false,
    })
    expect(track.halves[0][7]).toEqual({ round: 8, current: true })
    expect(track.halves[0][2]?.winner).toBeUndefined()
  })

  test("first overtime replaces regulation with six slots", () => {
    const history: RoundHistoryEntry[] = Array.from({ length: 24 }, (_, index) => ({
      round: index + 1,
      winner: index % 2 === 0 ? "CT" : "T",
      reason: "elimination" as const,
    }))
    const track = roundHistoryTrack(state(24, history))
    expect(track.overtime).toBe(1)
    expect(track.labels).toEqual([27, 30])
    expect(track.halves[0].map((slot) => slot.round)).toEqual([25, 26, 27])
    expect(track.halves[1].map((slot) => slot.round)).toEqual([28, 29, 30])
    expect(track.halves[0][0]).toEqual({ round: 25, current: true })
  })

  test("second overtime starts at round 31", () => {
    const track = roundHistoryTrack(
      state(30, [{ round: 30, winner: "CT", reason: "elimination" }])
    )
    expect(track.overtime).toBe(2)
    expect(track.halves[0][0]?.round).toBe(31)
    expect(track.labels).toEqual([33, 36])
  })
})
