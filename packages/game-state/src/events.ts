import type { RoundWinReason, Side } from "./types"

export type GameEvent =
  | { type: "round_started"; round: number }
  | {
      type: "round_ended"
      round: number
      winTeam: Side | null
      teamId?: string
      winReason?: RoundWinReason
    }
  | { type: "player_died"; steamId: string }
  | { type: "player_reappeared"; steamId: string }
  | {
      type: "observer_changed"
      steamId: string | null
      previousSteamId: string | null
    }
  | { type: "side_changed"; teamId: string; from: Side; to: Side }
  | { type: "bomb_planted" }
  | { type: "bomb_dropped" }
  | { type: "bomb_picked_up" }
  | { type: "map_ended"; mapName: string; teamId?: string }
