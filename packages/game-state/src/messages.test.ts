import { describe, expect, test } from "bun:test"
import { emptyPlayerPresentationConfig } from "@workspace/presentation"
import { defaultTheme } from "@workspace/theme"

import type { GameState } from "./types"
import { parseServerMessage, serializeServerMessage } from "./messages"

const sampleState: GameState = {
  timestamp: 1,
  map: { name: "de_inferno", phase: "live", round: 1, roundHistory: [] },
  round: { phase: "live", winTeam: null, alive: { ct: 0, t: 0 } },
  teams: [{ id: "team-1", name: "Northwind", side: "CT", score: 8, seriesWins: 0 }],
  players: [],
  observer: { playerSteamId: null },
  bomb: null,
  pause: null,
  worldGrenades: [],
}

describe("server messages", () => {
  test("round-trips connection, snapshot, event, theme, and presentation", () => {
    const messages = [
      { type: "connection" as const, data: { connected: true } },
      { type: "snapshot" as const, data: sampleState },
      { type: "event" as const, data: { type: "player_died" as const, steamId: "A" } },
      { type: "event" as const, data: { type: "bomb_planted" as const } },
      {
        type: "event" as const,
        data: { type: "map_ended" as const, mapName: "de_inferno", teamId: "team-1" },
      },
      {
        type: "event" as const,
        data: {
          type: "round_ended" as const,
          round: 14,
          winTeam: "CT" as const,
          teamId: "team-1",
          winReason: "elimination" as const,
        },
      },
      { type: "theme" as const, data: defaultTheme },
      { type: "presentation" as const, data: emptyPlayerPresentationConfig },
      {
        type: "broadcast-config" as const,
        data: {
          format: "BO3" as const,
          teams: { left: {}, right: {} },
          series: { leftMapsWon: 0, rightMapsWon: 0 },
        },
      },
      {
        type: "presentation" as const,
        data: {
          "76561198000000001": {
            displayName: "Nova",
            portrait: { type: "operator" as const, value: "ctm_sas_variantf" },
          },
        },
      },
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
    expect(parseServerMessage({ type: "presentation", data: { a: { portrait: { type: "operator", value: "nope" } } } })).toBeNull()
    expect(parseServerMessage({ type: "broadcast-config", data: { format: "BO2" } })).toBeNull()
    expect(parseServerMessage({ type: "overlay", data: { series: "BO3" } })).toEqual({
      type: "broadcast-config",
      data: {
        format: "BO3",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      },
    })
  })
})
