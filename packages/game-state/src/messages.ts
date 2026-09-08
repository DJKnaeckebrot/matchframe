import { matchframeThemeSchema } from "@workspace/theme"
import type { MatchframeTheme } from "@workspace/theme"

import type { GameEvent } from "./events"
import { isRoundWinReason } from "./selectors"
import type { GameState } from "./types"

export type ConnectionState = {
  connected: boolean
}

export type ServerMessage =
  | { type: "snapshot"; data: GameState }
  | { type: "event"; data: GameEvent }
  | { type: "connection"; data: ConnectionState }
  | { type: "theme"; data: MatchframeTheme }

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message)
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  const value = typeof raw === "string" ? parseJson(raw) : raw
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }

  if (value.type === "connection") {
    if (!isRecord(value.data) || typeof value.data.connected !== "boolean") {
      return null
    }
    return { type: "connection", data: { connected: value.data.connected } }
  }

  if (value.type === "event") {
    const event = parseGameEvent(value.data)
    return event ? { type: "event", data: event } : null
  }

  if (value.type === "snapshot") {
    if (!isGameStateShape(value.data)) {
      return null
    }
    return { type: "snapshot", data: value.data }
  }

  if (value.type === "theme") {
    const parsed = matchframeThemeSchema.safeParse(value.data)
    return parsed.success ? { type: "theme", data: parsed.data } : null
  }

  return null
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseGameEvent(value: unknown): GameEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }

  switch (value.type) {
    case "round_started":
      return typeof value.round === "number"
        ? { type: "round_started", round: value.round }
        : null
    case "round_ended":
      if (typeof value.round !== "number") {
        return null
      }
      if (value.winTeam !== "CT" && value.winTeam !== "T" && value.winTeam !== null) {
        return null
      }
      return {
        type: "round_ended",
        round: value.round,
        winTeam: value.winTeam,
        ...(typeof value.teamId === "string" ? { teamId: value.teamId } : {}),
        ...(isRoundWinReason(value.winReason) ? { winReason: value.winReason } : {}),
      }
    case "player_died":
    case "player_reappeared":
      return typeof value.steamId === "string"
        ? { type: value.type, steamId: value.steamId }
        : null
    case "observer_changed":
      if (
        (value.steamId !== null && typeof value.steamId !== "string") ||
        (value.previousSteamId !== null && typeof value.previousSteamId !== "string")
      ) {
        return null
      }
      return {
        type: "observer_changed",
        steamId: value.steamId,
        previousSteamId: value.previousSteamId,
      }
    case "side_changed":
      if (
        typeof value.teamId !== "string" ||
        (value.from !== "CT" && value.from !== "T") ||
        (value.to !== "CT" && value.to !== "T")
      ) {
        return null
      }
      return {
        type: "side_changed",
        teamId: value.teamId,
        from: value.from,
        to: value.to,
      }
    case "bomb_planted":
    case "bomb_dropped":
    case "bomb_picked_up":
      return { type: value.type }
    default:
      return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isGameStateShape(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    isRecord(value.map) &&
    isRecord(value.round) &&
    Array.isArray(value.teams) &&
    Array.isArray(value.players) &&
    isRecord(value.observer)
  )
}
