import type { GameEvent } from "./events"
import { assignTeamIdentity } from "./identity"
import type { BombState, BombStatus, GameState, PlayerState, TeamState } from "./types"

export type ApplyResult = {
  state: GameState
  events: GameEvent[]
}

export type GameStateEngine = {
  apply(snapshot: GameState): ApplyResult
  seedSeriesWins(left: number, right: number): GameState | null
  reset(): void
}

const PLANTED_SEQUENCE = new Set<BombStatus>(["planted", "defusing", "exploding"])

export function createGameStateEngine(): GameStateEngine {
  let previous: GameState | null = null
  let pendingSeriesWins: readonly [number, number] | null = null

  return {
    apply(snapshot: GameState): ApplyResult {
      const identified = assignTeamIdentity(previous, snapshot)
      const withBomb = captureBombProgress(previous, identified)
      let state = captureSeriesWins(previous, withBomb)
      if (pendingSeriesWins) {
        state = applySeriesWins(state, pendingSeriesWins[0], pendingSeriesWins[1])
        pendingSeriesWins = null
      }
      const events = previous === null ? [] : deriveEvents(previous, state)
      previous = state
      return { state, events }
    },
    seedSeriesWins(left: number, right: number): GameState | null {
      const wins = [clampSeriesWins(left), clampSeriesWins(right)] as const
      if (previous === null) {
        pendingSeriesWins = wins
        return null
      }
      pendingSeriesWins = null
      previous = applySeriesWins(previous, wins[0], wins[1])
      return previous
    },
    reset() {
      previous = null
      pendingSeriesWins = null
    },
  }
}

function isPlantedSequence(state: BombStatus | undefined): boolean {
  return state !== undefined && PLANTED_SEQUENCE.has(state)
}

function isNewRound(previous: GameState, next: GameState): boolean {
  return (
    next.map.round !== previous.map.round ||
    (previous.round.phase === "over" && next.round.phase === "freezetime")
  )
}

function captureBombProgress(previous: GameState | null, next: GameState): GameState {
  const bomb = next.bomb
  if (!bomb) {
    return next
  }

  if (!isPlantedSequence(bomb.state)) {
    return { ...next, bomb: stripCapturedProgress(bomb) }
  }

  const continueSequence =
    previous !== null &&
    isPlantedSequence(previous.bomb?.state) &&
    !isNewRound(previous, next)

  const captured: BombState = { state: bomb.state }
  if (bomb.carrierSteamId !== undefined) {
    captured.carrierSteamId = bomb.carrierSteamId
  }
  if (bomb.position !== undefined) {
    captured.position = bomb.position
  }

  let countdown = bomb.countdown
  if (countdown === undefined && continueSequence && previous.bomb?.countdown !== undefined) {
    countdown = previous.bomb.countdown
  }
  if (countdown !== undefined) {
    captured.countdown = countdown
  }

  const previousDuration = continueSequence ? previous.bomb?.countdownDuration : undefined
  if (previousDuration !== undefined) {
    captured.countdownDuration = previousDuration
  } else if (countdown !== undefined) {
    captured.countdownDuration = countdown
  }

  if (bomb.state === "defusing") {
    if (bomb.defuserSteamId !== undefined) {
      captured.defuserSteamId = bomb.defuserSteamId
    }
    if (bomb.defuseCountdown !== undefined) {
      captured.defuseCountdown = bomb.defuseCountdown
    }
    const continueDefuse = continueSequence && previous.bomb?.state === "defusing"
    if (continueDefuse && previous.bomb?.defuseDuration !== undefined) {
      captured.defuseDuration = previous.bomb.defuseDuration
    } else if (bomb.defuseCountdown !== undefined) {
      captured.defuseDuration = bomb.defuseCountdown
    }
  }

  return { ...next, bomb: captured }
}

/**
 * GSI `matches_won_this_series` is missing in scrims. Carry detected map wins
 * by logical team id until GSI reports a series, then trust GSI.
 *
 * ponytail: same-roster next series keeps the count until dashboard reset
 * or process restart.
 */
function captureSeriesWins(previous: GameState | null, next: GameState): GameState {
  const teams = mergeSeriesWins(previous, next.teams)
  if (previous === null || previous.map.phase === "gameover" || next.map.phase !== "gameover") {
    return teams === next.teams ? next : { ...next, teams }
  }

  const winner = mapWinner(teams)
  if (!winner || seriesAlreadyCounted(previous.teams, teams)) {
    return teams === next.teams ? next : { ...next, teams }
  }

  return {
    ...next,
    teams: teams.map((team) =>
      team.id === winner.id ? { ...team, seriesWins: team.seriesWins + 1 } : team
    ),
  }
}

function mergeSeriesWins(
  previous: GameState | null,
  teams: readonly TeamState[]
): readonly TeamState[] {
  if (previous === null || teams.some((team) => team.seriesWins > 0)) {
    return teams
  }
  let changed = false
  const merged = teams.map((team) => {
    const carried = previous.teams.find((entry) => entry.id === team.id)?.seriesWins ?? 0
    if (carried <= team.seriesWins) {
      return team
    }
    changed = true
    return { ...team, seriesWins: carried }
  })
  return changed ? merged : teams
}

function seriesAlreadyCounted(
  previous: readonly TeamState[],
  next: readonly TeamState[]
): boolean {
  return next.some((team) => {
    const before = previous.find((entry) => entry.id === team.id)?.seriesWins ?? 0
    return team.seriesWins > before
  })
}

function applySeriesWins(state: GameState, left: number, right: number): GameState {
  const teams = state.teams.map((team, index) => {
    const seriesWins = index === 0 ? left : index === 1 ? right : team.seriesWins
    return seriesWins === team.seriesWins ? team : { ...team, seriesWins }
  })
  return teams.every((team, index) => team === state.teams[index]) ? state : { ...state, teams }
}

function clampSeriesWins(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }
  return Math.min(4, Math.trunc(value))
}

function mapWinner(teams: readonly TeamState[]): TeamState | undefined {
  const lead = teams[0]
  if (!lead || teams.length < 2) {
    return undefined
  }
  let best = lead
  let unique = true
  for (const team of teams.slice(1)) {
    if (team.score > best.score) {
      best = team
      unique = true
    } else if (team.score === best.score) {
      unique = false
    }
  }
  return unique ? best : undefined
}

function stripCapturedProgress(bomb: BombState): BombState {
  const next: BombState = { state: bomb.state }
  if (bomb.carrierSteamId !== undefined) {
    next.carrierSteamId = bomb.carrierSteamId
  }
  if (bomb.position !== undefined) {
    next.position = bomb.position
  }
  return next
}

function deriveEvents(previous: GameState, next: GameState): GameEvent[] {
  const events: GameEvent[] = []

  if (previous.round.phase !== "over" && next.round.phase === "over") {
    const winner = next.teams.find((team) => team.side === next.round.winTeam)
    events.push({
      type: "round_ended",
      round: next.map.round,
      winTeam: next.round.winTeam,
      ...(winner ? { teamId: winner.id } : {}),
      ...(next.round.winReason ? { winReason: next.round.winReason } : {}),
    })
  }

  if (previous.map.phase !== "gameover" && next.map.phase === "gameover") {
    const mapWinnerTeam = mapWinner(next.teams)
    events.push({
      type: "map_ended",
      mapName: next.map.name,
      ...(mapWinnerTeam ? { teamId: mapWinnerTeam.id } : {}),
    })
  }

  if (
    next.map.round > previous.map.round ||
    (previous.round.phase === "over" && next.round.phase === "freezetime")
  ) {
    events.push({ type: "round_started", round: next.map.round })
  }

  const previousPlayers = new Map<string, PlayerState>()
  for (const player of previous.players) {
    previousPlayers.set(player.steamId, player)
  }
  for (const player of next.players) {
    const before = previousPlayers.get(player.steamId)
    if (!before) {
      continue
    }
    if (before.alive && !player.alive) {
      events.push({ type: "player_died", steamId: player.steamId })
    } else if (!before.alive && player.alive) {
      events.push({ type: "player_reappeared", steamId: player.steamId })
    }
  }

  if (previous.observer.playerSteamId !== next.observer.playerSteamId) {
    events.push({
      type: "observer_changed",
      steamId: next.observer.playerSteamId,
      previousSteamId: previous.observer.playerSteamId,
    })
  }

  const previousTeams = new Map(previous.teams.map((team) => [team.id, team]))
  for (const team of next.teams) {
    const before = previousTeams.get(team.id)
    if (before && before.side !== team.side) {
      events.push({
        type: "side_changed",
        teamId: team.id,
        from: before.side,
        to: team.side,
      })
    }
  }

  const previousBomb = previous.bomb?.state
  const nextBomb = next.bomb?.state
  if (previousBomb !== nextBomb) {
    if (nextBomb === "planted") {
      events.push({ type: "bomb_planted" })
    } else if (nextBomb === "dropped" && previousBomb === "carried") {
      events.push({ type: "bomb_dropped" })
    } else if (nextBomb === "carried" && previousBomb === "dropped") {
      events.push({ type: "bomb_picked_up" })
    }
  }

  return events
}
