import type { GameEvent } from "./events"
import type { GameState, PlayerState } from "./types"

export type AttributedKill = {
  killerSteamId: string
  victimSteamId: string
  killerTeamId: string
  victimTeamId: string
  enemy: boolean
}

export type ClutchCandidate = {
  playerSteamId: string
  teamId: string
  opponentsAtClutchStart: number
}

export type TeamRoster = {
  teamId: string
  steamIds: readonly string[]
}

export type AceAssessment =
  | {
      status: "ace"
      playerSteamId: string
      teamId: string
      roundKills: number
    }
  | { status: "none" }
  | { status: "unresolved"; reason: "ambiguous-killer" | "short-roster" }

export type MvpCandidate = {
  playerSteamId: string
  teamId: string
  roundKills: number
  score: number
}

export type RoundPerformanceState = {
  round: number
  rosterFromRoundStart: boolean
  startRosters: readonly TeamRoster[]
  kills: readonly AttributedKill[]
  unresolvedDeaths: readonly string[]
  clutch: ClutchCandidate | null
  clutchBroken: boolean
  planterSteamId?: string
  defuserSteamId?: string
}

export type RoundPerformanceTracker = {
  apply(previous: GameState | null, next: GameState, events: readonly GameEvent[]): RoundPerformanceState
  snapshot(): RoundPerformanceState
}

const ACE_ROSTER = 5

export function emptyRoundPerformance(round = 0): RoundPerformanceState {
  return {
    round,
    rosterFromRoundStart: false,
    startRosters: [],
    kills: [],
    unresolvedDeaths: [],
    clutch: null,
    clutchBroken: false,
  }
}

export function createRoundPerformanceTracker(): RoundPerformanceTracker {
  let current = emptyRoundPerformance()

  return {
    apply(previous, next, events) {
      current = applyRoundPerformance(current, previous, next, events)
      return current
    },
    snapshot() {
      return current
    },
  }
}

export function applyRoundPerformance(
  current: RoundPerformanceState,
  previous: GameState | null,
  next: GameState,
  events: readonly GameEvent[]
): RoundPerformanceState {
  const started = events.some((event) => event.type === "round_started")
  const ended = events.some((event) => event.type === "round_ended")
  const enteredFreeze =
    previous !== null &&
    previous.round.phase !== "freezetime" &&
    next.round.phase === "freezetime"
  let state = current
  // Keep this round's stats through round_ended even when CS2 also emits
  // round_started (map.round already incremented on the over payload).
  if ((previous === null || started || enteredFreeze) && !ended) {
    state = seedRound(next)
  }

  state = {
    ...state,
    round: next.map.round,
    kills: [...state.kills],
    unresolvedDeaths: [...state.unresolvedDeaths],
  }

  if (previous) {
    state = attributeDeaths(state, previous, next, events)
  }
  state = captureBombActors(state, next, events)
  if (next.round.phase !== "over") {
    state = updateClutch(state, next)
  }
  return freezePerformance(state)
}

export function enemyKillsByPlayer(state: RoundPerformanceState): Map<string, number> {
  const counts = new Map<string, number>()
  for (const kill of state.kills) {
    if (!kill.enemy) {
      continue
    }
    counts.set(kill.killerSteamId, (counts.get(kill.killerSteamId) ?? 0) + 1)
  }
  return counts
}

export function assessAce(state: RoundPerformanceState): AceAssessment {
  if (state.startRosters.length !== 2) {
    return { status: "none" }
  }

  const counts = enemyKillsByPlayer(state)
  for (const victims of state.startRosters) {
    if (victims.steamIds.length !== ACE_ROSTER) {
      continue
    }
    const killers = state.startRosters.find((entry) => entry.teamId !== victims.teamId)
    if (!killers) {
      continue
    }
    for (const [steamId, roundKills] of counts) {
      if (roundKills < ACE_ROSTER || !killers.steamIds.includes(steamId)) {
        continue
      }
      const uniqueVictims = new Set(
        state.kills
          .filter(
            (kill) =>
              kill.killerSteamId === steamId &&
              kill.enemy &&
              victims.steamIds.includes(kill.victimSteamId)
          )
          .map((kill) => kill.victimSteamId)
      )
      if (uniqueVictims.size >= ACE_ROSTER) {
        return {
          status: "ace",
          playerSteamId: steamId,
          teamId: killers.teamId,
          roundKills,
        }
      }
    }
  }

  if (state.startRosters.some((roster) => roster.steamIds.length < ACE_ROSTER)) {
    return { status: "unresolved", reason: "short-roster" }
  }
  if (state.unresolvedDeaths.length > 0) {
    return { status: "unresolved", reason: "ambiguous-killer" }
  }
  return { status: "none" }
}

export function clutchIfWon(
  state: RoundPerformanceState,
  winningTeamId: string
): ClutchCandidate | null {
  if (state.clutchBroken || !state.clutch) {
    return null
  }
  if (state.clutch.teamId !== winningTeamId) {
    return null
  }
  if (state.clutch.opponentsAtClutchStart < 1) {
    return null
  }
  return state.clutch
}

/**
 * Conservative MVP: round enemy kills, clutch win bonus, plant/defuse if known.
 * Returns none when every candidate scores 0 — automatic selection deferred.
 */
export function selectMvp(
  state: RoundPerformanceState,
  winningTeamId: string,
  players: readonly PlayerState[]
): MvpCandidate | null {
  const kills = enemyKillsByPlayer(state)
  const clutch = clutchIfWon(state, winningTeamId)
  let best: MvpCandidate | null = null
  for (const player of players) {
    if (player.teamId !== winningTeamId) {
      continue
    }
    const roundKills = kills.get(player.steamId) ?? 0
    let score = roundKills
    if (clutch?.playerSteamId === player.steamId) {
      score += 2
    }
    if (state.planterSteamId === player.steamId) {
      score += 1
    }
    if (state.defuserSteamId === player.steamId) {
      score += 1
    }
    if (score <= 0) {
      continue
    }
    if (!best || score > best.score || (score === best.score && player.steamId < best.playerSteamId)) {
      best = {
        playerSteamId: player.steamId,
        teamId: player.teamId,
        roundKills,
        score,
      }
    }
  }
  return best
}

function seedRound(next: GameState): RoundPerformanceState {
  return {
    round: next.map.round,
    rosterFromRoundStart: true,
    startRosters: rostersOf(next),
    kills: [],
    unresolvedDeaths: [],
    clutch: null,
    clutchBroken: false,
  }
}

function rostersOf(state: GameState): TeamRoster[] {
  const byTeam = new Map<string, string[]>()
  for (const team of state.teams) {
    byTeam.set(team.id, [])
  }
  for (const player of state.players) {
    const roster = byTeam.get(player.teamId)
    if (roster) {
      roster.push(player.steamId)
    }
  }
  return [...byTeam.entries()].map(([teamId, steamIds]) => ({ teamId, steamIds }))
}

function attributeDeaths(
  state: RoundPerformanceState,
  previous: GameState,
  next: GameState,
  events: readonly GameEvent[]
): RoundPerformanceState {
  const deaths = events.filter((event) => event.type === "player_died").map((event) => event.steamId)
  if (deaths.length === 0) {
    return state
  }

  const seen = new Set(state.kills.map((kill) => kill.victimSteamId))
  const deltas = killDeltas(previous, next)
  const attributed = [...state.kills]
  const unresolved = [...state.unresolvedDeaths]

  const uniqueDeaths = deaths.filter((steamId) => {
    if (seen.has(steamId)) {
      return false
    }
    seen.add(steamId)
    return true
  })

  const totalDelta = [...deltas.values()].reduce((sum, delta) => sum + delta, 0)
  const killerIds = [...deltas.keys()]

  if (uniqueDeaths.length === 1 && killerIds.length === 0) {
    return freezePerformance(state)
  }

  const oneKillerMulti =
    killerIds.length === 1 && (deltas.get(killerIds[0] ?? "") ?? 0) === uniqueDeaths.length
  const oneForOne =
    uniqueDeaths.length === 1 && killerIds.length === 1 && (deltas.get(killerIds[0] ?? "") ?? 0) === 1

  if (oneKillerMulti || oneForOne) {
    const killerId = killerIds[0]
    if (!killerId) {
      return freezePerformance(state)
    }
    const killer = playerOf(next, killerId) ?? playerOf(previous, killerId)
    for (const victimId of uniqueDeaths) {
      if (killerId === victimId) {
        continue
      }
      const victim = playerOf(next, victimId) ?? playerOf(previous, victimId)
      if (!killer || !victim) {
        unresolved.push(victimId)
        continue
      }
      attributed.push({
        killerSteamId: killerId,
        victimSteamId: victimId,
        killerTeamId: killer.teamId,
        victimTeamId: victim.teamId,
        enemy: killer.teamId !== victim.teamId,
      })
    }
    return { ...state, kills: attributed, unresolvedDeaths: unresolved }
  }

  if (totalDelta !== uniqueDeaths.length || killerIds.length !== uniqueDeaths.length) {
    unresolved.push(...uniqueDeaths)
    return { ...state, unresolvedDeaths: unresolved }
  }

  unresolved.push(...uniqueDeaths)
  return { ...state, unresolvedDeaths: unresolved }
}

function killDeltas(previous: GameState, next: GameState): Map<string, number> {
  const before = new Map(previous.players.map((player) => [player.steamId, player.kills]))
  const deltas = new Map<string, number>()
  for (const player of next.players) {
    const prior = before.get(player.steamId)
    if (prior === undefined) {
      continue
    }
    const delta = player.kills - prior
    if (delta > 0) {
      deltas.set(player.steamId, delta)
    }
  }
  return deltas
}

function captureBombActors(
  state: RoundPerformanceState,
  next: GameState,
  events: readonly GameEvent[]
): RoundPerformanceState {
  let planterSteamId = state.planterSteamId
  let defuserSteamId = state.defuserSteamId
  if (events.some((event) => event.type === "bomb_planted")) {
    planterSteamId = next.bomb?.carrierSteamId ?? planterSteamId
  }
  if (next.bomb?.state === "defusing" && next.bomb.defuserSteamId) {
    defuserSteamId = next.bomb.defuserSteamId
  }
  if (next.bomb?.state === "defused" && next.bomb.defuserSteamId) {
    defuserSteamId = next.bomb.defuserSteamId
  }
  return {
    ...state,
    ...(planterSteamId ? { planterSteamId } : {}),
    ...(defuserSteamId ? { defuserSteamId } : {}),
  }
}

function updateClutch(state: RoundPerformanceState, next: GameState): RoundPerformanceState {
  if (next.round.phase !== "live" || next.pause) {
    return state
  }
  if (state.startRosters.length !== 2) {
    return state
  }

  const alive = new Map<string, string[]>()
  for (const roster of state.startRosters) {
    alive.set(roster.teamId, [])
  }
  for (const player of next.players) {
    if (!player.alive) {
      continue
    }
    const list = alive.get(player.teamId)
    if (list) {
      list.push(player.steamId)
    }
  }

  const teams = state.startRosters.map((roster) => ({
    teamId: roster.teamId,
    alive: alive.get(roster.teamId) ?? [],
  }))
  const solo = teams.find((team) => team.alive.length === 1)
  const other = teams.find((team) => team.teamId !== solo?.teamId)

  if (state.clutch && !state.clutchBroken) {
    const clutching = teams.find((team) => team.teamId === state.clutch?.teamId)
    if (clutching && clutching.alive.length >= 2) {
      return { ...state, clutch: null, clutchBroken: true }
    }
    return state
  }

  if (state.clutchBroken || !solo || !other) {
    return state
  }
  if (other.alive.length < 1) {
    return state
  }

  const playerSteamId = solo.alive[0]
  if (!playerSteamId) {
    return state
  }
  return {
    ...state,
    clutch: {
      playerSteamId,
      teamId: solo.teamId,
      opponentsAtClutchStart: other.alive.length,
    },
  }
}

function playerOf(state: GameState, steamId: string): PlayerState | undefined {
  return state.players.find((player) => player.steamId === steamId)
}

function freezePerformance(state: RoundPerformanceState): RoundPerformanceState {
  return {
    ...state,
    startRosters: state.startRosters.map((roster) => ({
      teamId: roster.teamId,
      steamIds: [...roster.steamIds],
    })),
    kills: [...state.kills],
    unresolvedDeaths: [...state.unresolvedDeaths],
  }
}
