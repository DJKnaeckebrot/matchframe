import { describe, expect, test } from "bun:test"

import { createGameStateEngine } from "./engine"
import { aliveCountsBySide } from "./selectors"
import type {
  BombState,
  GameState,
  PauseState,
  PlayerEquipment,
  PlayerState,
  RoundWinReason,
  Side,
  TeamState,
} from "./types"

const CT_ROSTER = ["A", "B", "C", "D", "E"]
const T_ROSTER = ["F", "G", "H", "I", "J"]

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

function emptyEquipment(): PlayerEquipment {
  return {
    grenades: [],
    hasHelmet: false,
    hasDefuseKit: false,
    hasBomb: false,
  }
}

function roster(ids: readonly string[], teamId: string, side: Side): PlayerState[] {
  return ids.map((id) => player(id, teamId, side))
}

function snapshot(options: {
  teams?: readonly TeamState[]
  players?: readonly PlayerState[]
  round?: number
  roundPhase?: GameState["round"]["phase"]
  winTeam?: Side | null
  winReason?: RoundWinReason
  timeRemaining?: number
  observer?: string | null
  timestamp?: number
  bomb?: BombState | null
  pause?: PauseState | null
}): GameState {
  const players =
    options.players ?? [...roster(CT_ROSTER, "ct", "CT"), ...roster(T_ROSTER, "t", "T")]
  return {
    timestamp: options.timestamp ?? 1,
    map: { name: "de_inferno", phase: "live", round: options.round ?? 1, roundHistory: [] },
    round: {
      phase: options.roundPhase ?? "live",
      winTeam: options.winTeam ?? null,
      ...(options.winReason ? { winReason: options.winReason } : {}),
      ...(options.timeRemaining !== undefined ? { timeRemaining: options.timeRemaining } : {}),
      alive: aliveCountsBySide(players),
    },
    teams: options.teams ?? [
      { id: "ct", name: "CT", side: "CT", score: 8, seriesWins: 0 },
      { id: "t", name: "T", side: "T", score: 6, seriesWins: 0 },
    ],
    players,
    observer: { playerSteamId: options.observer ?? "A" },
    bomb: options.bomb ?? null,
    pause: options.pause ?? null,
    worldGrenades: [],
  }
}

describe("createGameStateEngine", () => {
  test("initial snapshot does not generate transition events", () => {
    const engine = createGameStateEngine()
    const result = engine.apply(snapshot({}))

    expect(result.events).toEqual([])
    expect(result.state.teams.map((team) => team.id)).toEqual(["team-1", "team-2"])
    expect(result.state.players[0]?.teamId).toBe("team-1")
  })

  test("identity remains stable without a side switch", () => {
    const engine = createGameStateEngine()
    const first = engine.apply(snapshot({ timestamp: 1 }))
    const second = engine.apply(snapshot({ timestamp: 2 }))

    expect(second.events).toEqual([])
    expect(second.state.teams).toEqual(first.state.teams)
  })

  test("identity survives a full CT → T side switch", () => {
    const engine = createGameStateEngine()
    const first = engine.apply(snapshot({}))
    const ctId = first.state.teams[0]?.id
    const tId = first.state.teams[1]?.id

    const swapped = engine.apply(
      snapshot({
        timestamp: 2,
        teams: [
          { id: "ct", name: "CT", side: "CT", score: 6, seriesWins: 0 },
          { id: "t", name: "T", side: "T", score: 8, seriesWins: 0 },
        ],
        players: [
          ...roster(T_ROSTER, "ct", "CT"),
          ...roster(CT_ROSTER, "t", "T"),
        ],
      })
    )

    expect(swapped.state.teams).toEqual([
      { id: ctId, name: "T", side: "T", score: 8, seriesWins: 0 },
      { id: tId, name: "CT", side: "CT", score: 6, seriesWins: 0 },
    ])
    expect(swapped.state.players.find((p) => p.steamId === "A")?.teamId).toBe(ctId)
    expect(swapped.state.players.find((p) => p.steamId === "F")?.teamId).toBe(tId)
    expect(swapped.events).toEqual([
      { type: "side_changed", teamId: ctId, from: "CT", to: "T" },
      { type: "side_changed", teamId: tId, from: "T", to: "CT" },
    ])
  })

  test("identity survives a side switch with one player missing", () => {
    const engine = createGameStateEngine()
    const first = engine.apply(snapshot({}))
    const ctId = first.state.teams[0]?.id
    const tId = first.state.teams[1]?.id

    const swapped = engine.apply(
      snapshot({
        timestamp: 2,
        teams: [
          { id: "ct", name: "CT", side: "CT", score: 6, seriesWins: 0 },
          { id: "t", name: "T", side: "T", score: 8, seriesWins: 0 },
        ],
        players: [
          ...roster(T_ROSTER, "ct", "CT"),
          ...roster(CT_ROSTER.slice(0, 4), "t", "T"),
        ],
      })
    )

    expect(swapped.state.teams[0]?.id).toBe(ctId)
    expect(swapped.state.teams[1]?.id).toBe(tId)
    expect(swapped.state.players.find((p) => p.steamId === "A")?.teamId).toBe(ctId)
  })

  test("two unrelated rosters are not incorrectly merged", () => {
    const engine = createGameStateEngine()
    const first = engine.apply(snapshot({}))
    const known = new Set(first.state.teams.map((team) => team.id))

    const other = engine.apply(
      snapshot({
        timestamp: 2,
        players: [
          ...roster(["K", "L", "M", "N", "O"], "ct", "CT"),
          ...roster(["P", "Q", "R", "S", "T"], "t", "T"),
        ],
      })
    )

    expect(other.state.teams.every((team) => !known.has(team.id))).toBe(true)
    expect(other.events.filter((event) => event.type === "side_changed")).toEqual([])
  })

  test("round end and round start", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ round: 14, roundPhase: "live" }))

    const ended = engine.apply(
      snapshot({
        round: 14,
        roundPhase: "over",
        winTeam: "CT",
        winReason: "elimination",
        timestamp: 2,
      })
    )
    expect(ended.events).toEqual([
      {
        type: "round_ended",
        round: 14,
        winTeam: "CT",
        teamId: ended.state.teams.find((team) => team.side === "CT")?.id,
        winReason: "elimination",
      },
    ])

    const started = engine.apply(
      snapshot({ round: 15, roundPhase: "freezetime", timestamp: 3 })
    )
    expect(started.events).toEqual([{ type: "round_started", round: 15 }])
  })

  test("player death and reappear", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({}))

    const dead = engine.apply(
      snapshot({
        timestamp: 2,
        players: [
          player("A", "ct", "CT", { alive: false, health: 0 }),
          ...roster(CT_ROSTER.slice(1), "ct", "CT"),
          ...roster(T_ROSTER, "t", "T"),
        ],
      })
    )
    expect(dead.events).toEqual([{ type: "player_died", steamId: "A" }])

    const alive = engine.apply(
      snapshot({
        timestamp: 3,
        players: [
          player("A", "ct", "CT", { alive: true, health: 100 }),
          ...roster(CT_ROSTER.slice(1), "ct", "CT"),
          ...roster(T_ROSTER, "t", "T"),
        ],
      })
    )
    expect(alive.events).toEqual([{ type: "player_reappeared", steamId: "A" }])
  })

  test("observer change", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ observer: "A" }))

    const changed = engine.apply(snapshot({ observer: "F", timestamp: 2 }))
    expect(changed.events).toEqual([
      { type: "observer_changed", steamId: "F", previousSteamId: "A" },
    ])
  })

  test("bomb picked up, dropped, and planted", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({}))

    const carried = engine.apply(
      snapshot({ timestamp: 2, bomb: { state: "carried", carrierSteamId: "F" } })
    )
    expect(carried.events.filter((event) => event.type.startsWith("bomb_"))).toEqual([])

    const dropped = engine.apply(
      snapshot({ timestamp: 3, bomb: { state: "dropped", position: { x: 1, y: 2, z: 3 } } })
    )
    expect(dropped.events).toEqual([{ type: "bomb_dropped" }])

    const picked = engine.apply(
      snapshot({ timestamp: 4, bomb: { state: "carried", carrierSteamId: "G" } })
    )
    expect(picked.events).toEqual([{ type: "bomb_picked_up" }])

    const planted = engine.apply(
      snapshot({ timestamp: 5, bomb: { state: "planted", countdown: 40 } })
    )
    expect(planted.events).toEqual([{ type: "bomb_planted" }])
    expect(planted.state.bomb).toEqual({
      state: "planted",
      countdown: 40,
      countdownDuration: 40,
    })

    const defused = engine.apply(
      snapshot({
        timestamp: 6,
        roundPhase: "over",
        winTeam: "CT",
        winReason: "bomb_defused",
        bomb: { state: "defused" },
      })
    )
    expect(defused.state.bomb).toEqual({ state: "defused" })
    expect(defused.events).toContainEqual({
      type: "round_ended",
      round: 1,
      winTeam: "CT",
      teamId: defused.state.teams.find((team) => team.side === "CT")?.id,
      winReason: "bomb_defused",
    })
  })

  test("bomb planted then exploded", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ bomb: { state: "planted", countdown: 2 } }))
    const exploded = engine.apply(
      snapshot({
        timestamp: 2,
        roundPhase: "over",
        winTeam: "T",
        winReason: "bomb_exploded",
        bomb: { state: "exploded" },
      })
    )
    expect(exploded.state.bomb).toEqual({ state: "exploded" })
    expect(exploded.state.round.winReason).toBe("bomb_exploded")
  })

  test("logical teams keep visual order after a side switch", () => {
    const engine = createGameStateEngine()
    const first = engine.apply(
      snapshot({
        teams: [
          { id: "northwind", name: "Northwind", side: "CT", score: 8, seriesWins: 1 },
          { id: "redline", name: "Redline", side: "T", score: 6, seriesWins: 0 },
        ],
        players: [
          ...roster(CT_ROSTER, "northwind", "CT"),
          ...roster(T_ROSTER, "redline", "T"),
        ],
      })
    )

    const swapped = engine.apply(
      snapshot({
        timestamp: 2,
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 8, seriesWins: 1 },
        ],
        players: [
          ...roster(T_ROSTER, "redline", "CT"),
          ...roster(CT_ROSTER, "northwind", "T"),
        ],
      })
    )

    expect(first.state.teams.map((team) => team.id)).toEqual(["northwind", "redline"])
    expect(swapped.state.teams.map((team) => [team.id, team.side])).toEqual([
      ["northwind", "T"],
      ["redline", "CT"],
    ])
    expect(swapped.state.teams[0]?.name).toBe("Northwind")
    expect(swapped.state.teams[1]?.name).toBe("Redline")
    expect(swapped.state.teams.map((team) => team.seriesWins)).toEqual([1, 0])
  })

  test("round_ended resolves the logical winner after a side switch", () => {
    const engine = createGameStateEngine()
    engine.apply(
      snapshot({
        teams: [
          { id: "northwind", name: "Northwind", side: "CT", score: 8, seriesWins: 0 },
          { id: "redline", name: "Redline", side: "T", score: 6, seriesWins: 0 },
        ],
        players: [
          ...roster(CT_ROSTER, "northwind", "CT"),
          ...roster(T_ROSTER, "redline", "T"),
        ],
      })
    )
    engine.apply(
      snapshot({
        timestamp: 2,
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 8, seriesWins: 0 },
        ],
        players: [
          ...roster(T_ROSTER, "redline", "CT"),
          ...roster(CT_ROSTER, "northwind", "T"),
        ],
      })
    )

    const ended = engine.apply(
      snapshot({
        timestamp: 3,
        roundPhase: "over",
        winTeam: "T",
        winReason: "elimination",
        teams: [
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
          { id: "northwind", name: "Northwind", side: "T", score: 9, seriesWins: 0 },
        ],
        players: [
          ...roster(T_ROSTER, "redline", "CT"),
          ...roster(CT_ROSTER, "northwind", "T"),
        ],
      })
    )

    expect(ended.events).toEqual([
      {
        type: "round_ended",
        round: 1,
        winTeam: "T",
        teamId: "northwind",
        winReason: "elimination",
      },
    ])
    expect(ended.state.teams[0]?.id).toBe("northwind")
  })

  test("round result state clears when the next freeze begins", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ round: 14, roundPhase: "live" }))
    engine.apply(
      snapshot({ round: 14, roundPhase: "over", winTeam: "CT", timestamp: 2 })
    )
    const next = engine.apply(
      snapshot({ round: 15, roundPhase: "freezetime", timestamp: 3 })
    )
    expect(next.state.round.phase).toBe("freezetime")
    expect(next.state.round.winTeam).toBeNull()
    expect(next.state.round.winReason).toBeUndefined()
    expect(next.events).toEqual([{ type: "round_started", round: 15 }])
  })
})

describe("bomb progress capture", () => {
  test("initial planted snapshot stores initial bomb duration", () => {
    const engine = createGameStateEngine()
    const planted = engine.apply(snapshot({ bomb: { state: "planted", countdown: 28.4 } }))
    expect(planted.state.bomb).toEqual({
      state: "planted",
      countdown: 28.4,
      countdownDuration: 28.4,
    })
  })

  test("subsequent planted snapshots preserve duration and update remaining", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 28.4 } }))
    const later = engine.apply(
      snapshot({ timestamp: 2, bomb: { state: "planted", countdown: 17.3 } })
    )
    expect(later.state.bomb).toEqual({
      state: "planted",
      countdown: 17.3,
      countdownDuration: 28.4,
    })
  })

  test("planted to defusing preserves bomb timer and captures defuse duration", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 28.4 } }))
    const defusing = engine.apply(
      snapshot({
        timestamp: 2,
        bomb: { state: "defusing", defuserSteamId: "A", defuseCountdown: 4.2 },
      })
    )
    expect(defusing.state.bomb).toEqual({
      state: "defusing",
      defuserSteamId: "A",
      countdown: 28.4,
      countdownDuration: 28.4,
      defuseCountdown: 4.2,
      defuseDuration: 4.2,
    })
  })

  test("later defusing snapshots preserve defuse duration", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 20 } }))
    engine.apply(
      snapshot({ timestamp: 2, bomb: { state: "defusing", defuseCountdown: 4.2 } })
    )
    const later = engine.apply(
      snapshot({ timestamp: 3, bomb: { state: "defusing", defuseCountdown: 1.1 } })
    )
    expect(later.state.bomb).toMatchObject({
      countdown: 20,
      countdownDuration: 20,
      defuseCountdown: 1.1,
      defuseDuration: 4.2,
    })
  })

  test("defuse stopping clears defuse countdown state", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 28.4 } }))
    engine.apply(
      snapshot({ timestamp: 2, bomb: { state: "defusing", defuseCountdown: 4.2 } })
    )
    const planted = engine.apply(
      snapshot({ timestamp: 3, bomb: { state: "planted", countdown: 17.3 } })
    )
    expect(planted.state.bomb).toEqual({
      state: "planted",
      countdown: 17.3,
      countdownDuration: 28.4,
    })
    expect(planted.state.bomb?.defuseCountdown).toBeUndefined()
    expect(planted.state.bomb?.defuseDuration).toBeUndefined()
  })

  test("defused clears bomb and defuse progress state", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 28.4 } }))
    engine.apply(
      snapshot({ timestamp: 2, bomb: { state: "defusing", defuseCountdown: 4.2 } })
    )
    const defused = engine.apply(snapshot({ timestamp: 3, bomb: { state: "defused" } }))
    expect(defused.state.bomb).toEqual({ state: "defused" })
  })

  test("exploded clears bomb and defuse progress state", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 5.2 } }))
    const exploded = engine.apply(snapshot({ timestamp: 2, bomb: { state: "exploded" } }))
    expect(exploded.state.bomb).toEqual({ state: "exploded" })
  })

  test("new round resets captured durations", () => {
    const engine = createGameStateEngine()
    engine.apply(
      snapshot({ round: 14, timestamp: 1, bomb: { state: "planted", countdown: 28.4 } })
    )
    engine.apply(
      snapshot({
        round: 14,
        timestamp: 2,
        roundPhase: "over",
        winTeam: "CT",
        bomb: { state: "defused" },
      })
    )
    const next = engine.apply(
      snapshot({
        round: 15,
        roundPhase: "freezetime",
        timestamp: 3,
        bomb: { state: "carried", carrierSteamId: "F" },
      })
    )
    expect(next.state.bomb).toEqual({ state: "carried", carrierSteamId: "F" })

    const planted = engine.apply(
      snapshot({ round: 15, timestamp: 4, bomb: { state: "planted", countdown: 39.1 } })
    )
    expect(planted.state.bomb).toEqual({
      state: "planted",
      countdown: 39.1,
      countdownDuration: 39.1,
    })
  })

  test("second independent plant captures a new duration", () => {
    const engine = createGameStateEngine()
    engine.apply(snapshot({ timestamp: 1, bomb: { state: "planted", countdown: 28.4 } }))
    engine.apply(snapshot({ timestamp: 2, bomb: { state: "exploded" } }))
    const second = engine.apply(
      snapshot({ timestamp: 3, bomb: { state: "planted", countdown: 40 } })
    )
    expect(second.state.bomb).toEqual({
      state: "planted",
      countdown: 40,
      countdownDuration: 40,
    })
  })

  test("missing countdown does not invent one", () => {
    const engine = createGameStateEngine()
    const planted = engine.apply(snapshot({ bomb: { state: "planted" } }))
    expect(planted.state.bomb).toEqual({ state: "planted" })
    expect(planted.state.bomb?.countdown).toBeUndefined()
    expect(planted.state.bomb?.countdownDuration).toBeUndefined()
  })
})
