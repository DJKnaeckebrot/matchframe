import { describe, expect, test } from "bun:test"

import {
  aliveCountsBySide,
  getBombDisplayState,
  getDisplayRoundNumber,
  getLogicalTeamAliveCount,
  getRoundDisplayState,
  getTeamObjectiveProgress,
} from "./selectors"
import type { GameState, PlayerState, Side } from "./types"

function player(
  steamId: string,
  teamId: string,
  side: Side,
  alive = true
): PlayerState {
  return {
    steamId,
    name: steamId,
    teamId,
    side,
    alive,
    health: alive ? 100 : 0,
    armor: 0,
    money: 800,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: { grenades: [], hasHelmet: false, hasDefuseKit: false, hasBomb: false },
  }
}

function state(overrides: Partial<GameState> = {}): GameState {
  const players = overrides.players ?? [
    player("a", "northwind", "CT"),
    player("b", "northwind", "CT"),
    player("c", "northwind", "CT"),
    player("d", "northwind", "CT"),
    player("e", "northwind", "CT"),
    player("f", "redline", "T"),
    player("g", "redline", "T"),
    player("h", "redline", "T"),
    player("i", "redline", "T"),
    player("j", "redline", "T"),
  ]
  const { round: roundOverride, ...rest } = overrides
  return {
    timestamp: 1,
    map: { name: "de_inferno", phase: "live", round: 14 },
    teams: [
      { id: "northwind", name: "Northwind", side: "CT", score: 8 },
      { id: "redline", name: "Redline", side: "T", score: 6 },
    ],
    players,
    observer: { playerSteamId: "a" },
    bomb: null,
    pause: null,
    ...rest,
    round: {
      phase: "live",
      winTeam: null,
      alive: aliveCountsBySide(players),
      ...roundOverride,
    },
  }
}

describe("aliveCountsBySide", () => {
  const cases: { name: string; dead: string[]; ct: number; t: number }[] = [
    { name: "5v5", dead: [], ct: 5, t: 5 },
    { name: "4v5", dead: ["e"], ct: 4, t: 5 },
    { name: "1v2", dead: ["b", "c", "d", "e", "h", "i", "j"], ct: 1, t: 2 },
  ]

  for (const { name, dead, ct, t } of cases) {
    test(name, () => {
      const roster = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
      const players = roster.map((id) =>
        player(id, id < "f" ? "northwind" : "redline", id < "f" ? "CT" : "T", !dead.includes(id))
      )
      expect(aliveCountsBySide(players)).toEqual({ ct, t })
    })
  }

  test("dead players are excluded", () => {
    expect(
      aliveCountsBySide([
        player("a", "northwind", "CT", false),
        player("f", "redline", "T", false),
      ])
    ).toEqual({ ct: 0, t: 0 })
  })
})

describe("getLogicalTeamAliveCount", () => {
  test("follows logical team identity after a side switch", () => {
    const swapped = state({
      teams: [
        { id: "northwind", name: "Northwind", side: "T", score: 8 },
        { id: "redline", name: "Redline", side: "CT", score: 6 },
      ],
      players: [
        player("a", "northwind", "T"),
        player("b", "northwind", "T"),
        player("c", "northwind", "T", false),
        player("d", "northwind", "T"),
        player("e", "northwind", "T"),
        player("f", "redline", "CT"),
        player("g", "redline", "CT"),
        player("h", "redline", "CT"),
        player("i", "redline", "CT", false),
        player("j", "redline", "CT", false),
      ],
    })

    expect(swapped.round.alive).toEqual({ ct: 3, t: 4 })
    expect(getLogicalTeamAliveCount(swapped, "northwind")).toBe(4)
    expect(getLogicalTeamAliveCount(swapped, "redline")).toBe(3)
  })
})

describe("getBombDisplayState", () => {
  test("carried and dropped are not planted", () => {
    expect(getBombDisplayState(state({ bomb: { state: "carried", carrierSteamId: "f" } }))).toEqual({
      planted: false,
    })
    expect(getBombDisplayState(state({ bomb: { state: "dropped" } }))).toEqual({ planted: false })
  })

  test("planted exposes countdown when present", () => {
    expect(getBombDisplayState(state({ bomb: { state: "planted", countdown: 28.4 } }))).toEqual({
      planted: true,
      countdown: 28.4,
    })
  })

  test("defusing is still planted and does not use the defuse timer as bomb remaining", () => {
    expect(
      getBombDisplayState(
        state({
          bomb: { state: "defusing", defuseCountdown: 4.2, countdown: 17.3 },
        })
      )
    ).toEqual({ planted: true, countdown: 17.3 })
  })

  test("planted without countdown still shows planted", () => {
    expect(getBombDisplayState(state({ bomb: { state: "planted" } }))).toEqual({ planted: true })
  })

  test("defused and exploded clear planted UI", () => {
    expect(getBombDisplayState(state({ bomb: { state: "defused" } }))).toEqual({ planted: false })
    expect(getBombDisplayState(state({ bomb: { state: "exploded" } }))).toEqual({ planted: false })
  })
})

describe("getRoundDisplayState", () => {
  test("freeze, live, bomb, and over", () => {
    expect(
      getRoundDisplayState(
        state({ round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 }, timeRemaining: 12 } })
      )
    ).toMatchObject({ kind: "freezetime", timeRemaining: 12, round: 15 })

    expect(
      getRoundDisplayState(
        state({ round: { phase: "live", winTeam: null, alive: { ct: 5, t: 5 }, timeRemaining: 83.4 } })
      )
    ).toMatchObject({ kind: "live", timeRemaining: 83.4 })

    expect(
      getRoundDisplayState(state({ bomb: { state: "planted", countdown: 28.4 } }))
    ).toMatchObject({ kind: "bomb", round: 15 })
    expect(
      getRoundDisplayState(state({ bomb: { state: "planted", countdown: 28.4 } })).timeRemaining
    ).toBeUndefined()

    const over = getRoundDisplayState(
      state({
        round: { phase: "over", winTeam: "CT", winReason: "elimination", alive: { ct: 3, t: 0 } },
      })
    )
    expect(over).toMatchObject({
      kind: "over",
      winTeam: "CT",
      winnerTeamId: "northwind",
      winnerName: "Northwind",
      winReason: "elimination",
    })
  })

  test("round result clears on the next freeze", () => {
    const freeze = getRoundDisplayState(
      state({
        round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 }, timeRemaining: 12 },
      })
    )
    expect(freeze.kind).toBe("freezetime")
    expect(freeze.winTeam).toBeNull()
    expect(freeze.winnerName).toBeUndefined()
  })

  test("logical winner after side switch", () => {
    const display = getRoundDisplayState(
      state({
        round: { phase: "over", winTeam: "T", alive: { ct: 0, t: 2 } },
        teams: [
          { id: "northwind", name: "Northwind", side: "T", score: 9 },
          { id: "redline", name: "Redline", side: "CT", score: 6 },
        ],
      })
    )
    expect(display.winnerTeamId).toBe("northwind")
    expect(display.winnerName).toBe("Northwind")
  })

  test("pause and timeout take priority over live clock", () => {
    expect(
      getRoundDisplayState(
        state({
          round: { phase: "live", winTeam: null, alive: { ct: 5, t: 5 }, timeRemaining: 70 },
          pause: { kind: "paused", timeRemaining: 45 },
        })
      )
    ).toMatchObject({ kind: "paused", timeRemaining: 45 })

    expect(
      getRoundDisplayState(
        state({
          pause: { kind: "timeout", side: "CT", timeRemaining: 30 },
        })
      )
    ).toMatchObject({ kind: "timeout", timeoutSide: "CT", timeRemaining: 30 })
  })
})

describe("getDisplayRoundNumber", () => {
  test("first round is R1", () => {
    const first = state({ map: { name: "de_inferno", phase: "live", round: 0 } })
    expect(first.map.round).toBe(0)
    expect(getDisplayRoundNumber(first)).toBe(1)
    expect(getRoundDisplayState(first).round).toBe(1)
  })

  test("8-6 live state is R15", () => {
    const live = state({})
    expect(live.map.round).toBe(14)
    expect(live.teams[0]?.score).toBe(8)
    expect(live.teams[1]?.score).toBe(6)
    expect(getDisplayRoundNumber(live)).toBe(15)
    expect(getRoundDisplayState(live).round).toBe(15)
  })

  test("round-over keeps the round that just ended", () => {
    const over = state({
      round: { phase: "over", winTeam: "CT", alive: { ct: 5, t: 0 } },
    })
    expect(over.map.round).toBe(14)
    expect(getDisplayRoundNumber(over)).toBe(15)
    expect(getRoundDisplayState(over)).toMatchObject({ kind: "over", round: 15 })
  })

  test("next freeze displays the following round", () => {
    const next = state({
      map: { name: "de_inferno", phase: "live", round: 15 },
      round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 }, timeRemaining: 12 },
    })
    expect(next.map.round).toBe(15)
    expect(getDisplayRoundNumber(next)).toBe(16)
    expect(getRoundDisplayState(next)).toMatchObject({ kind: "freezetime", round: 16 })
  })

  test("side switch does not change the display round", () => {
    const swapped = state({
      teams: [
        { id: "northwind", name: "Northwind", side: "T", score: 8 },
        { id: "redline", name: "Redline", side: "CT", score: 6 },
      ],
    })
    expect(swapped.map.round).toBe(14)
    expect(getDisplayRoundNumber(swapped)).toBe(15)
    expect(getRoundDisplayState(swapped).round).toBe(15)
  })
})

describe("getTeamObjectiveProgress", () => {
  test("before halftime T receives bomb and CT receives defuse", () => {
    const planted = state({
      bomb: { state: "planted", countdown: 28.4, countdownDuration: 28.4 },
    })
    expect(planted.teams[0]).toMatchObject({ id: "northwind", side: "CT" })
    expect(planted.teams[1]).toMatchObject({ id: "redline", side: "T" })
    expect(getTeamObjectiveProgress(planted, "northwind")).toEqual({ kind: "none" })
    expect(getTeamObjectiveProgress(planted, "redline")).toEqual({
      kind: "bomb",
      remaining: 28.4,
      duration: 28.4,
    })

    const defusing = state({
      bomb: {
        state: "defusing",
        countdown: 17.3,
        countdownDuration: 28.4,
        defuseCountdown: 4.2,
        defuseDuration: 4.2,
      },
    })
    expect(getTeamObjectiveProgress(defusing, "northwind")).toEqual({
      kind: "defuse",
      remaining: 4.2,
      duration: 4.2,
    })
    expect(getTeamObjectiveProgress(defusing, "redline")).toEqual({
      kind: "bomb",
      remaining: 17.3,
      duration: 28.4,
    })
  })

  test("after side switch logical order is unchanged and bars follow current side", () => {
    const swapped = state({
      teams: [
        { id: "northwind", name: "Northwind", side: "T", score: 8 },
        { id: "redline", name: "Redline", side: "CT", score: 6 },
      ],
      players: [
        player("a", "northwind", "T"),
        player("b", "northwind", "T"),
        player("c", "northwind", "T"),
        player("d", "northwind", "T"),
        player("e", "northwind", "T"),
        player("f", "redline", "CT"),
        player("g", "redline", "CT"),
        player("h", "redline", "CT"),
        player("i", "redline", "CT"),
        player("j", "redline", "CT"),
      ],
      bomb: {
        state: "defusing",
        countdown: 22.1,
        countdownDuration: 28.4,
        defuseCountdown: 3.7,
        defuseDuration: 5,
      },
    })

    expect(swapped.teams.map((team) => [team.id, team.side])).toEqual([
      ["northwind", "T"],
      ["redline", "CT"],
    ])
    expect(getTeamObjectiveProgress(swapped, "northwind")).toEqual({
      kind: "bomb",
      remaining: 22.1,
      duration: 28.4,
    })
    expect(getTeamObjectiveProgress(swapped, "redline")).toEqual({
      kind: "defuse",
      remaining: 3.7,
      duration: 5,
    })
  })

  test("does not assume left is CT or right is T", () => {
    const swappedPlanted = state({
      teams: [
        { id: "northwind", name: "Northwind", side: "T", score: 8 },
        { id: "redline", name: "Redline", side: "CT", score: 6 },
      ],
      bomb: { state: "planted", countdown: 28.4, countdownDuration: 28.4 },
    })
    expect(getTeamObjectiveProgress(swappedPlanted, swappedPlanted.teams[0]!.id).kind).toBe("bomb")
    expect(getTeamObjectiveProgress(swappedPlanted, swappedPlanted.teams[1]!.id).kind).toBe("none")
  })

  test("carried, dropped, defused, and exploded hide both bars", () => {
    for (const bomb of [
      { state: "carried" as const, carrierSteamId: "f" },
      { state: "dropped" as const },
      { state: "defused" as const },
      { state: "exploded" as const },
    ]) {
      const current = state({ bomb })
      expect(getTeamObjectiveProgress(current, "northwind")).toEqual({ kind: "none" })
      expect(getTeamObjectiveProgress(current, "redline")).toEqual({ kind: "none" })
    }
  })
})
