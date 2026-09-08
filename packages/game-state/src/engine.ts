import type { GameEvent } from "./events"
import { assignTeamIdentity } from "./identity"
import type { BombState, BombStatus, GameState, PlayerState } from "./types"

export type ApplyResult = {
  state: GameState
  events: GameEvent[]
}

export type GameStateEngine = {
  apply(snapshot: GameState): ApplyResult
}

const PLANTED_SEQUENCE = new Set<BombStatus>(["planted", "defusing", "exploding"])

export function createGameStateEngine(): GameStateEngine {
  let previous: GameState | null = null

  return {
    apply(snapshot: GameState): ApplyResult {
      const identified = assignTeamIdentity(previous, snapshot)
      const state = captureBombProgress(previous, identified)
      const events = previous === null ? [] : deriveEvents(previous, state)
      previous = state
      return { state, events }
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
