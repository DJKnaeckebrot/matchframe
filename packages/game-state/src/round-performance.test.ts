import { describe, expect, test } from "bun:test"

import { createGameStateEngine } from "./engine"
import {
  createInterstitialDirector,
  INTERSTITIAL_DURATION_MS,
  pickInterstitial,
  sequenceInterstitials,
  type BroadcastInterstitial,
} from "./interstitials"
import {
  assessAce,
  clutchIfWon,
  createRoundPerformanceTracker,
  selectMvp,
} from "./round-performance"
import { aliveCountsBySide } from "./selectors"
import type { GameState, PlayerEquipment, PlayerState, RoundWinReason, Side, TeamState } from "./types"

const CT_ROSTER = ["A", "B", "C", "D", "E"] as const
const T_ROSTER = ["F", "G", "H", "I", "J"] as const

function emptyEquipment(): PlayerEquipment {
  return { grenades: [], hasHelmet: false, hasDefuseKit: false, hasBomb: false }
}

function player(
  steamId: string,
  teamId: string,
  side: Side,
  overrides: Partial<PlayerState> = {}
): PlayerState {
  return {
    steamId,
    name: steamId,
    teamId,
    side,
    alive: true,
    health: 100,
    armor: 0,
    money: 800,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: emptyEquipment(),
    ...overrides,
  }
}

function snapshot(options: {
  players?: readonly PlayerState[]
  teams?: readonly TeamState[]
  round?: number
  roundPhase?: GameState["round"]["phase"]
  winTeam?: Side | null
  winReason?: RoundWinReason
  timestamp?: number
}): GameState {
  const players =
    options.players ??
    [...CT_ROSTER.map((id) => player(id, "ct", "CT")), ...T_ROSTER.map((id) => player(id, "t", "T"))]
  return {
    timestamp: options.timestamp ?? 1,
    map: {
      name: "de_inferno",
      phase: "live",
      round: options.round ?? 3,
      roundHistory: [],
    },
    round: {
      phase: options.roundPhase ?? "live",
      winTeam: options.winTeam ?? null,
      ...(options.winReason ? { winReason: options.winReason } : {}),
      alive: aliveCountsBySide(players),
    },
    teams: options.teams ?? [
      { id: "ct", name: "Northwind", side: "CT", score: 8, seriesWins: 0 },
      { id: "t", name: "Redline", side: "T", score: 6, seriesWins: 0 },
    ],
    players,
    observer: { playerSteamId: "A" },
    bomb: null,
    pause: null,
    worldGrenades: [],
  }
}

function withKills(
  players: readonly PlayerState[],
  steamId: string,
  kills: number,
  extras: Partial<PlayerState> = {}
): PlayerState[] {
  return players.map((entry) =>
    entry.steamId === steamId ? { ...entry, kills, ...extras } : entry
  )
}

function kill(
  players: readonly PlayerState[],
  killerId: string,
  victimId: string,
  killerKills: number
): PlayerState[] {
  return players.map((entry) => {
    if (entry.steamId === victimId) {
      return { ...entry, alive: false, health: 0, deaths: entry.deaths + 1 }
    }
    if (entry.steamId === killerId) {
      return { ...entry, kills: killerKills }
    }
    return entry
  })
}

function session() {
  const engine = createGameStateEngine()
  const tracker = createRoundPerformanceTracker()
  const director = createInterstitialDirector()
  let previous: GameState | null = null
  let clock = 1000

  function apply(next: GameState, now = (clock += 100)) {
    const result = engine.apply(next)
    const performance = tracker.apply(previous, result.state, result.events)
    const action = director.apply(previous, result, now)
    previous = result.state
    return { result, performance, action, now }
  }

  return { apply, tracker, director }
}

describe("ACE detection", () => {
  test("five valid enemy kills is an ACE", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    let players: PlayerState[] = [...snapshot({}).players]
    apply(snapshot({ players, roundPhase: "live" }))
    let kills = 1
    for (const victim of T_ROSTER) {
      players = kill(players, "A", victim, kills)
      kills += 1
      apply(snapshot({ players, roundPhase: "live", timestamp: kills }))
    }
    const ace = assessAce(apply(snapshot({ players, roundPhase: "live" })).performance)
    expect(ace).toMatchObject({ status: "ace", playerSteamId: "A", roundKills: 5 })
  })

  test("suicide is ignored", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const players = snapshot({}).players.map((entry) =>
      entry.steamId === "F" ? { ...entry, alive: false, health: 0, deaths: 1 } : entry
    )
    const ace = assessAce(apply(snapshot({ players })).performance)
    expect(ace.status).toBe("none")
    expect(apply(snapshot({ players })).performance.kills).toEqual([])
  })

  test("teamkill is ignored", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const players = kill(snapshot({}).players, "A", "B", 1)
    const perf = apply(snapshot({ players })).performance
    expect(perf.kills).toEqual([
      expect.objectContaining({ killerSteamId: "A", victimSteamId: "B", enemy: false }),
    ])
    expect(assessAce(perf).status).toBe("none")
  })

  test("duplicate kill is ignored", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    let players = kill(snapshot({}).players, "A", "F", 1)
    apply(snapshot({ players, timestamp: 2 }))
    players = withKills(players, "A", 2)
    const perf = apply(snapshot({ players, timestamp: 3 })).performance
    expect(perf.kills).toHaveLength(1)
  })

  test("four kills is not an ACE", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    let players: PlayerState[] = [...snapshot({}).players]
    let kills = 1
    for (const victim of T_ROSTER.slice(0, 4)) {
      players = kill(players, "A", victim, kills)
      kills += 1
      apply(snapshot({ players, timestamp: kills }))
    }
    expect(assessAce(apply(snapshot({ players })).performance).status).toBe("none")
  })

  test("round reset clears counters", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime", round: 3 }))
    let players = kill(snapshot({ round: 3 }).players, "A", "F", 1)
    apply(snapshot({ players, round: 3 }))
    const reset = apply(
      snapshot({
        round: 4,
        roundPhase: "freezetime",
        timestamp: 9,
      })
    )
    expect(reset.result.events.some((event) => event.type === "round_started")).toBe(true)
    expect(reset.performance.kills).toEqual([])
    expect(assessAce(reset.performance).status).toBe("none")
  })

  test("same-tick round_ended still keeps ACE kills when the map round already incremented", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime", round: 5 }))
    let players: PlayerState[] = [...snapshot({ round: 5 }).players]
    apply(snapshot({ players, round: 5, roundPhase: "live" }))
    let kills = 1
    for (const victim of T_ROSTER) {
      players = kill(players, "A", victim, kills)
      kills += 1
      apply(snapshot({ players, round: 5, roundPhase: "live", timestamp: kills }))
    }
    const overAndStarted = apply(
      snapshot({
        players,
        round: 6,
        roundPhase: "over",
        winTeam: "CT",
        winReason: "elimination",
        timestamp: 20,
      })
    )
    expect(overAndStarted.result.events.some((event) => event.type === "round_ended")).toBe(true)
    expect(overAndStarted.result.events.some((event) => event.type === "round_started")).toBe(true)
    expect(assessAce(overAndStarted.performance)).toMatchObject({
      status: "ace",
      playerSteamId: "A",
      roundKills: 5,
    })
  })

  test("short opposing roster is unresolved, not an ACE", () => {
    const { apply } = session()
    const players = [
      ...CT_ROSTER.map((id) => player(id, "ct", "CT")),
      ...T_ROSTER.slice(0, 4).map((id) => player(id, "t", "T")),
    ]
    apply(snapshot({ players, roundPhase: "freezetime" }))
    let live = players
    let kills = 1
    for (const victim of T_ROSTER.slice(0, 4)) {
      live = kill(live, "A", victim, kills)
      kills += 1
      apply(snapshot({ players: live, timestamp: kills }))
    }
    expect(assessAce(apply(snapshot({ players: live })).performance)).toEqual({
      status: "unresolved",
      reason: "short-roster",
    })
  })

  test("ambiguous killer is unresolved", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const players = snapshot({}).players.map((entry) => {
      if (entry.steamId === "F") {
        return { ...entry, alive: false, health: 0 }
      }
      if (entry.steamId === "A" || entry.steamId === "B") {
        return { ...entry, kills: 1 }
      }
      return entry
    })
    expect(assessAce(apply(snapshot({ players })).performance)).toEqual({
      status: "unresolved",
      reason: "ambiguous-killer",
    })
  })
})

describe("clutch detection", () => {
  test.each([1, 2, 3, 4, 5] as const)("1v%s win", (n) => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const livePlayers = snapshot({}).players.map((entry) => {
      if (entry.teamId === "ct" && entry.steamId !== "A") {
        return { ...entry, alive: false, health: 0 }
      }
      if (entry.teamId === "t") {
        const index = T_ROSTER.indexOf(entry.steamId as (typeof T_ROSTER)[number])
        if (index >= n) {
          return { ...entry, alive: false, health: 0 }
        }
      }
      return entry
    })
    apply(snapshot({ players: livePlayers, roundPhase: "live", timestamp: 2 }))
    const endedPlayers = livePlayers.map((entry) =>
      entry.teamId === "t" ? { ...entry, alive: false, health: 0 } : entry
    )
    const ended = apply(
      snapshot({
        players: endedPlayers,
        roundPhase: "over",
        winTeam: "CT",
        winReason: "elimination",
        timestamp: 3,
      })
    )
    const ctId = ended.result.state.teams.find((team) => team.side === "CT")?.id
    expect(ctId).toBeDefined()
    expect(clutchIfWon(ended.performance, ctId ?? "")).toMatchObject({
      playerSteamId: "A",
      opponentsAtClutchStart: n,
    })
  })

  test("solo state then loss is not a clutch", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const livePlayers = snapshot({}).players.map((entry) => {
      if (entry.steamId !== "A" && entry.teamId === "ct") {
        return { ...entry, alive: false, health: 0 }
      }
      if (T_ROSTER.slice(2).includes(entry.steamId as (typeof T_ROSTER)[number])) {
        return { ...entry, alive: false, health: 0 }
      }
      return entry
    })
    apply(snapshot({ players: livePlayers, timestamp: 2 }))
    const loss = apply(
      snapshot({
        players: livePlayers.map((entry) =>
          entry.steamId === "A" ? { ...entry, alive: false, health: 0 } : entry
        ),
        roundPhase: "over",
        winTeam: "T",
        winReason: "elimination",
        timestamp: 3,
      })
    )
    const winner = loss.result.events.find((event) => event.type === "round_ended")
    expect(winner && winner.type === "round_ended" ? winner.teamId : undefined).toBeDefined()
    expect(
      clutchIfWon(loss.performance, winner && winner.type === "round_ended" ? winner.teamId ?? "" : "")
    ).toBeNull()
  })

  test("team no longer solo before round end is not a clutch", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const solo = snapshot({}).players.map((entry) =>
      entry.teamId === "ct" && entry.steamId !== "A" ? { ...entry, alive: false, health: 0 } : entry
    )
    apply(snapshot({ players: solo, timestamp: 2 }))
    const revived = snapshot({}).players
    apply(snapshot({ players: revived, timestamp: 3 }))
    const ended = apply(
      snapshot({
        roundPhase: "over",
        winTeam: "CT",
        winReason: "elimination",
        timestamp: 4,
        players: revived.map((entry) =>
          entry.teamId === "t" ? { ...entry, alive: false, health: 0 } : entry
        ),
      })
    )
    const ctId = ended.result.state.teams.find((team) => team.side === "CT")?.id ?? ""
    expect(ended.performance.clutchBroken).toBe(true)
    expect(clutchIfWon(ended.performance, ctId)).toBeNull()
  })

  test("side switch keeps logical clutch identity", () => {
    const { apply } = session()
    apply(
      snapshot({
        roundPhase: "freezetime",
        teams: [
          { id: "northwind", name: "Northwind", side: "CT", score: 8, seriesWins: 0 },
          { id: "redline", name: "Redline", side: "T", score: 6, seriesWins: 0 },
        ],
        players: [
          ...CT_ROSTER.map((id) => player(id, "northwind", "CT")),
          ...T_ROSTER.map((id) => player(id, "redline", "T")),
        ],
      })
    )
    apply(
      snapshot({
        timestamp: 2,
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 8, seriesWins: 0 },
        ],
        players: [
          ...T_ROSTER.map((id) => player(id, "redline", "CT")),
          ...CT_ROSTER.map((id) => player(id, "northwind", "T")),
        ],
      })
    )
    const live = [
      ...T_ROSTER.map((id) => player(id, "redline", "CT", { alive: false, health: 0 })),
      ...CT_ROSTER.map((id) =>
        player(id, "northwind", "T", id === "A" ? {} : { alive: false, health: 0 })
      ),
    ]
    live[0] = player("F", "redline", "CT")
    live[1] = player("G", "redline", "CT")
    apply(
      snapshot({
        timestamp: 3,
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 8, seriesWins: 0 },
        ],
        players: live,
      })
    )
    const ended = apply(
      snapshot({
        timestamp: 4,
        roundPhase: "over",
        winTeam: "T",
        winReason: "elimination",
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 9, seriesWins: 0 },
        ],
        players: live.map((entry) =>
          entry.teamId === "redline" ? { ...entry, alive: false, health: 0 } : entry
        ),
      })
    )
    expect(ended.result.events).toContainEqual(
      expect.objectContaining({ type: "round_ended", teamId: "northwind", winTeam: "T" })
    )
    expect(clutchIfWon(ended.performance, "northwind")).toMatchObject({
      playerSteamId: "A",
      teamId: "northwind",
      opponentsAtClutchStart: 2,
    })
  })
})

describe("MVP selection", () => {
  test("uses round kills, not match K/D", () => {
    const { apply } = session()
    const padded = snapshot({}).players.map((entry) =>
      entry.steamId === "B" ? { ...entry, kills: 40 } : entry
    )
    apply(snapshot({ roundPhase: "freezetime", players: padded }))
    let players = kill(padded, "A", "F", 1)
    apply(snapshot({ players, timestamp: 2 }))
    players = kill(players, "A", "G", 2)
    apply(snapshot({ players, timestamp: 3 }))
    const ended = apply(
      snapshot({
        players: players.map((entry) =>
          entry.teamId === "t" ? { ...entry, alive: false, health: 0 } : entry
        ),
        roundPhase: "over",
        winTeam: "CT",
        timestamp: 4,
      })
    )
    const ctId = ended.result.state.teams.find((team) => team.side === "CT")?.id ?? ""
    expect(selectMvp(ended.performance, ctId, ended.result.state.players)).toMatchObject({
      playerSteamId: "A",
      roundKills: 2,
    })
  })

  test("deferred when no supported round stats exist", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    const ended = apply(
      snapshot({
        roundPhase: "over",
        winTeam: "CT",
        winReason: "time_expired",
        timestamp: 2,
      })
    )
    const ctId = ended.result.state.teams.find((team) => team.side === "CT")?.id ?? ""
    expect(selectMvp(ended.performance, ctId, ended.result.state.players)).toBeNull()
  })

  test("tie-break is deterministic by steam id", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    let players = kill(snapshot({}).players, "B", "F", 1)
    apply(snapshot({ players, timestamp: 2 }))
    players = kill(players, "C", "G", 1)
    apply(snapshot({ players, timestamp: 3 }))
    const ended = apply(
      snapshot({
        players,
        roundPhase: "over",
        winTeam: "CT",
        timestamp: 4,
      })
    )
    const ctId = ended.result.state.teams.find((team) => team.side === "CT")?.id ?? ""
    expect(selectMvp(ended.performance, ctId, ended.result.state.players)?.playerSteamId).toBe("B")
  })
})

describe("interstitial director", () => {
  test("round winner uses logical team and normalized reason after a side switch", () => {
    const { apply } = session()
    apply(
      snapshot({
        roundPhase: "live",
        teams: [
          { id: "northwind", name: "Northwind", side: "CT", score: 8, seriesWins: 0 },
          { id: "redline", name: "Redline", side: "T", score: 6, seriesWins: 0 },
        ],
        players: [
          ...CT_ROSTER.map((id) => player(id, "northwind", "CT")),
          ...T_ROSTER.map((id) => player(id, "redline", "T")),
        ],
      })
    )
    apply(
      snapshot({
        timestamp: 2,
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 8, seriesWins: 0 },
        ],
        players: [
          ...T_ROSTER.map((id) => player(id, "redline", "CT")),
          ...CT_ROSTER.map((id) => player(id, "northwind", "T")),
        ],
      })
    )
    const ended = apply(
      snapshot({
        timestamp: 3,
        roundPhase: "over",
        winTeam: "T",
        winReason: "bomb_exploded",
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 9, seriesWins: 0 },
        ],
        players: [
          ...T_ROSTER.map((id) => player(id, "redline", "CT")),
          ...CT_ROSTER.map((id) => player(id, "northwind", "T")),
        ],
      })
    )
    expect(ended.action.type).toBe("set")
    if (ended.action.type !== "set") {
      return
    }
    expect(ended.action.payload.card).toMatchObject({
      type: "round-winner",
      teamId: "northwind",
      winReason: "bomb_exploded",
      side: "T",
    })
  })

  test("ACE outranks clutch, MVP, and round winner", () => {
    const cards: BroadcastInterstitial[] = [
      {
        type: "round-winner",
        id: "w",
        createdAt: 1,
        teamId: "ct",
      },
      { type: "mvp", id: "m", createdAt: 1, teamId: "ct", playerSteamId: "A", roundKills: 5 },
      {
        type: "clutch",
        id: "c",
        createdAt: 1,
        teamId: "ct",
        playerSteamId: "A",
        opponentsAtClutchStart: 3,
      },
      { type: "ace", id: "a", createdAt: 1, teamId: "ct", playerSteamId: "A", roundKills: 5 },
    ]
    expect(pickInterstitial(cards)?.type).toBe("ace")
    expect(sequenceInterstitials(cards).map((card) => card.type)).toEqual(["round-winner", "ace"])
  })

  test("sequences round winner then clutch, skipping MVP", () => {
    expect(
      sequenceInterstitials([
        { type: "round-winner", id: "w", createdAt: 1, teamId: "ct" },
        { type: "mvp", id: "m", createdAt: 1, teamId: "ct", playerSteamId: "A", roundKills: 2 },
        {
          type: "clutch",
          id: "c",
          createdAt: 1,
          teamId: "ct",
          playerSteamId: "A",
          opponentsAtClutchStart: 4,
        },
      ]).map((card) => card.type)
    ).toEqual(["round-winner", "clutch"])
  })

  test("plays round winner then ACE, then expires", () => {
    const { apply, director } = session()
    apply(snapshot({ roundPhase: "freezetime" }))
    let players: PlayerState[] = [...snapshot({}).players]
    apply(snapshot({ players, roundPhase: "live" }))
    let kills = 1
    for (const victim of T_ROSTER) {
      players = kill(players, "A", victim, kills)
      kills += 1
      apply(snapshot({ players, roundPhase: "live", timestamp: kills }))
    }
    const over = apply(
      snapshot({
        players,
        roundPhase: "over",
        winTeam: "CT",
        winReason: "elimination",
        timestamp: 20,
      }),
      50_000
    )
    expect(over.action.type).toBe("set")
    if (over.action.type !== "set") {
      return
    }
    expect(over.action.payload.card.type).toBe("round-winner")
    const aceAt = 50_000 + INTERSTITIAL_DURATION_MS["round-winner"]
    expect(director.peek(aceAt - 1)?.card.type).toBe("round-winner")
    expect(director.peek(aceAt)?.card.type).toBe("ace")
    const doneAt = aceAt + INTERSTITIAL_DURATION_MS.ace
    expect(director.peek(doneAt - 1)?.card.type).toBe("ace")
    expect(director.peek(doneAt)).toBeNull()
  })

  test("duplicate round_ended does not retrigger", () => {
    const { apply } = session()
    apply(snapshot({ roundPhase: "live" }))
    const over = snapshot({ roundPhase: "over", winTeam: "CT", winReason: "elimination", timestamp: 2 })
    const first = apply(over, 5000)
    const second = apply({ ...over, timestamp: 3 }, 5100)
    expect(first.action.type).toBe("set")
    expect(second.action.type).toBe("hold")
  })

  test("expires after the centralized duration", () => {
    const { apply, director } = session()
    apply(snapshot({ roundPhase: "live" }))
    const over = apply(
      snapshot({ roundPhase: "over", winTeam: "CT", winReason: "elimination", timestamp: 2 }),
      10_000
    )
    expect(over.action.type).toBe("set")
    if (over.action.type !== "set") {
      return
    }
    const duration = INTERSTITIAL_DURATION_MS[over.action.payload.card.type]
    expect(director.peek(10_000 + duration - 1)).not.toBeNull()
    const later = apply(
      { ...snapshot({ roundPhase: "over", winTeam: "CT", timestamp: 3 }) },
      10_000 + duration
    )
    expect(later.action.type).toBe("clear")
    expect(director.peek(10_000 + duration + 1)).toBeNull()
  })

  test("next freeze and a live flicker keep the card until duration expires", () => {
    const { apply, director } = session()
    apply(snapshot({ roundPhase: "live", round: 3 }))
    const over = apply(
      snapshot({ round: 3, roundPhase: "over", winTeam: "CT", timestamp: 2 }),
      20_000
    )
    expect(over.action.type).toBe("set")
    const freeze = apply(
      snapshot({ round: 4, roundPhase: "freezetime", timestamp: 3 }),
      20_400
    )
    expect(freeze.action.type).toBe("hold")
    const live = apply(
      snapshot({ round: 4, roundPhase: "live", timestamp: 4 }),
      20_800
    )
    expect(live.action.type).toBe("hold")
    expect(director.peek(20_800)?.card.type).toBe("round-winner")
  })

  test("same-tick round_ended and round_started still queues ACE after the winner", () => {
    const { apply, director } = session()
    apply(snapshot({ roundPhase: "freezetime", round: 3 }))
    let players: PlayerState[] = [...snapshot({ round: 3 }).players]
    apply(snapshot({ players, round: 3, roundPhase: "live" }))
    let kills = 1
    for (const victim of T_ROSTER) {
      players = kill(players, "A", victim, kills)
      kills += 1
      apply(snapshot({ players, round: 3, roundPhase: "live", timestamp: kills }))
    }
    const both = apply(
      snapshot({
        players,
        round: 4,
        roundPhase: "over",
        winTeam: "CT",
        winReason: "elimination",
        timestamp: 20,
      }),
      30_000
    )
    expect(both.action.type).toBe("set")
    if (both.action.type !== "set") {
      return
    }
    expect(both.action.payload.card.type).toBe("round-winner")
    const aceAt = 30_000 + INTERSTITIAL_DURATION_MS["round-winner"]
    expect(director.peek(aceAt)?.card.type).toBe("ace")
  })
})
