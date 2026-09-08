import type {
  GameState,
  PauseState,
  PlayerState,
  RoundWinReason,
  Side,
} from "./types"

export function aliveCountsBySide(players: readonly PlayerState[]): {
  ct: number
  t: number
} {
  let ct = 0
  let t = 0
  for (const player of players) {
    if (!player.alive) {
      continue
    }
    if (player.side === "CT") {
      ct += 1
    } else if (player.side === "T") {
      t += 1
    }
  }
  return { ct, t }
}

export function getLogicalTeamAliveCount(state: GameState, teamId: string): number {
  let count = 0
  for (const player of state.players) {
    if (player.teamId === teamId && player.alive) {
      count += 1
    }
  }
  return count
}

export type TeamObjectiveProgress =
  | { kind: "none" }
  | { kind: "bomb"; remaining?: number; duration?: number }
  | { kind: "defuse"; remaining?: number; duration?: number }

const PLANTED_STATES = new Set(["planted", "defusing", "exploding"])

/** Progress bars follow current side, not visual left/right. */
export function getTeamObjectiveProgress(
  state: GameState,
  teamId: string
): TeamObjectiveProgress {
  const team = state.teams.find((entry) => entry.id === teamId)
  const bomb = state.bomb
  if (!team || !bomb || !PLANTED_STATES.has(bomb.state)) {
    return { kind: "none" }
  }

  if (team.side === "T") {
    return {
      kind: "bomb",
      ...(bomb.countdown !== undefined ? { remaining: bomb.countdown } : {}),
      ...(bomb.countdownDuration !== undefined ? { duration: bomb.countdownDuration } : {}),
    }
  }

  if (team.side === "CT" && bomb.state === "defusing") {
    return {
      kind: "defuse",
      ...(bomb.defuseCountdown !== undefined ? { remaining: bomb.defuseCountdown } : {}),
      ...(bomb.defuseDuration !== undefined ? { duration: bomb.defuseDuration } : {}),
    }
  }

  return { kind: "none" }
}

export type BombDisplayState =
  | { planted: false }
  | { planted: true; countdown?: number }

export function getBombDisplayState(state: GameState): BombDisplayState {
  const bomb = state.bomb
  if (
    bomb?.state !== "planted" &&
    bomb?.state !== "defusing" &&
    bomb?.state !== "exploding"
  ) {
    return { planted: false }
  }
  if (bomb.countdown === undefined) {
    return { planted: true }
  }
  return { planted: true, countdown: bomb.countdown }
}

export type RoundDisplayKind =
  | "unknown"
  | "freezetime"
  | "live"
  | "bomb"
  | "over"
  | "paused"
  | "timeout"

export type RoundDisplayState = {
  kind: RoundDisplayKind
  mapName: string
  /** 1-based round number for broadcast UI. */
  round: number
  timeRemaining?: number
  winTeam: Side | null
  winnerTeamId?: string
  winnerName?: string
  timeoutSide?: Side
}

/** CS2 GSI `map.round` is a 0-based index. */
export function getDisplayRoundNumber(state: GameState): number {
  return state.map.round + 1
}

export function getRoundDisplayState(state: GameState): RoundDisplayState {
  const mapName = state.map.name
  const round = getDisplayRoundNumber(state)
  const bomb = getBombDisplayState(state)

  if (state.pause) {
    return pauseDisplay(state.pause, mapName, round)
  }
  if (bomb.planted && state.round.phase !== "over") {
    return {
      kind: "bomb",
      mapName,
      round,
      winTeam: null,
    }
  }
  if (state.round.phase === "over") {
    return overDisplay(state, mapName, round)
  }
  if (state.round.phase === "freezetime" || state.round.phase === "live") {
    const display: RoundDisplayState = {
      kind: state.round.phase,
      mapName,
      round,
      winTeam: null,
    }
    if (state.round.timeRemaining !== undefined) {
      display.timeRemaining = state.round.timeRemaining
    }
    return display
  }
  return { kind: "unknown", mapName, round, winTeam: null }
}

function pauseDisplay(
  pause: PauseState,
  mapName: string,
  round: number
): RoundDisplayState {
  if (pause.kind === "timeout") {
    const display: RoundDisplayState = {
      kind: "timeout",
      mapName,
      round,
      winTeam: null,
      timeoutSide: pause.side,
    }
    if (pause.timeRemaining !== undefined) {
      display.timeRemaining = pause.timeRemaining
    }
    return display
  }
  const display: RoundDisplayState = {
    kind: "paused",
    mapName,
    round,
    winTeam: null,
  }
  if (pause.timeRemaining !== undefined) {
    display.timeRemaining = pause.timeRemaining
  }
  return display
}

function overDisplay(
  state: GameState,
  mapName: string,
  round: number
): RoundDisplayState {
  const winner = state.teams.find((team) => team.side === state.round.winTeam)
  const display: RoundDisplayState = {
    kind: "over",
    mapName,
    round,
    winTeam: state.round.winTeam,
  }
  if (state.round.timeRemaining !== undefined) {
    display.timeRemaining = state.round.timeRemaining
  }
  if (winner) {
    display.winnerTeamId = winner.id
    display.winnerName = winner.name
  }
  return display
}

export function isRoundWinReason(value: unknown): value is RoundWinReason {
  return (
    value === "elimination" ||
    value === "bomb_exploded" ||
    value === "bomb_defused" ||
    value === "time_expired"
  )
}
