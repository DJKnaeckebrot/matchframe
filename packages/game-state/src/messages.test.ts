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
        type: "interstitial" as const,
        data: {
          card: {
            type: "ace" as const,
            id: "ace:3:A",
            createdAt: 1000,
            teamId: "team-1",
            playerSteamId: "A",
            roundKills: 5,
            side: "CT" as const,
          },
          expiresAt: 4500,
        },
      },
      { type: "interstitial" as const, data: null },
      { type: "match-reset" as const },
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
    expect(parseServerMessage({ type: "interstitial", data: { card: { type: "ace" } } })).toBeNull()
    expect(parseServerMessage({ type: "interstitial", data: null })).toEqual({
      type: "interstitial",
      data: null,
    })
    expect(parseServerMessage({ type: "match-reset" })).toEqual({ type: "match-reset" })
    expect(parseServerMessage({ type: "overlay", data: { series: "BO3" } })).toEqual({
      type: "broadcast-config",
      data: {
        format: "BO3",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      },
    })
    expect(
      parseServerMessage({
        type: "broadcast-config",
        data: {
          format: "BO1",
          sponsor: { enabled: true, name: "Local LAN", position: "center", displayMode: "text" },
        },
      })
    ).toEqual({
      type: "broadcast-config",
      data: {
        format: "BO1",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
        sponsors: [
          {
            enabled: true,
            name: "Local LAN",
            position: "center",
            displayMode: "text",
          },
        ],
      },
    })
  })
})
