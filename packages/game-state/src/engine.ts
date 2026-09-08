import type { GameEvent } from "./events"
import { assignTeamIdentity } from "./identity"
import type { GameState, PlayerState } from "./types"

export type ApplyResult = {
  state: GameState
  events: GameEvent[]
}

export type GameStateEngine = {
  apply(snapshot: GameState): ApplyResult
}

export function createGameStateEngine(): GameStateEngine {
  let previous: GameState | null = null

  return {
    apply(snapshot: GameState): ApplyResult {
      const state = assignTeamIdentity(previous, snapshot)
      const events = previous === null ? [] : deriveEvents(previous, state)
      previous = state
      return { state, events }
    },
  }
}

function deriveEvents(previous: GameState, next: GameState): GameEvent[] {
  const events: GameEvent[] = []

  if (previous.round.phase !== "over" && next.round.phase === "over") {
    events.push({
      type: "round_ended",
      round: next.map.round,
      winTeam: next.round.winTeam,
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
