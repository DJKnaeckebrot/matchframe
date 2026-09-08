import { describe, expect, test } from "bun:test"
import { defaultTheme } from "@workspace/theme"

import type { GameState } from "./types"
import { parseServerMessage, serializeServerMessage } from "./messages"

const sampleState: GameState = {
  timestamp: 1,
  map: { name: "de_inferno", phase: "live", round: 1 },
  round: { phase: "live", winTeam: null },
  teams: [{ id: "team-1", name: "Northwind", side: "CT", score: 8 }],
  players: [],
  observer: { playerSteamId: null },
  bomb: null,
}

describe("server messages", () => {
  test("round-trips connection, snapshot, event, and theme", () => {
    const messages = [
      { type: "connection" as const, data: { connected: true } },
      { type: "snapshot" as const, data: sampleState },
      { type: "event" as const, data: { type: "player_died" as const, steamId: "A" } },
      { type: "event" as const, data: { type: "bomb_planted" as const } },
      {
        type: "event" as const,
        data: { type: "round_ended" as const, round: 14, winTeam: "CT" as const },
      },
      { type: "theme" as const, data: defaultTheme },
    ]

    for (const message of messages) {
      expect(parseServerMessage(serializeServerMessage(message))).toEqual(message)
    }
  })

  test("parses a JSON string and rejects invalid payloads", () => {
    expect(parseServerMessage('{"type":"connection","data":{"connected":false}}')).toEqual({
      type: "connection",
      data: { connected: false },
    })
    expect(parseServerMessage("{")).toBeNull()
    expect(parseServerMessage({ type: "unknown" })).toBeNull()
    expect(parseServerMessage({ type: "event", data: { type: "player_died" } })).toBeNull()
    expect(parseServerMessage({ type: "theme", data: { accent: "nope" } })).toBeNull()
  })
})
