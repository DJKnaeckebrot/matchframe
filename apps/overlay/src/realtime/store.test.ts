import { describe, expect, test } from "bun:test"
import { defaultBroadcastConfig, emptyPlayerPresentationConfig } from "@workspace/presentation"
import { defaultTheme } from "@workspace/theme"

import type { GameState } from "@workspace/game-state"

import { useRealtimeStore } from "./store"

const sample: GameState = {
  timestamp: 1,
  map: { name: "de_inferno", phase: "live", round: 12, roundHistory: [] },
  round: { phase: "live", winTeam: null, alive: { ct: 5, t: 5 } },
  teams: [
    { id: "team-1", name: "Northwind", side: "CT", score: 8, seriesWins: 1 },
    { id: "team-2", name: "Redline", side: "T", score: 6, seriesWins: 0 },
  ],
  players: [
    {
      steamId: "A",
      name: "A",
      teamId: "team-1",
      side: "CT",
      alive: true,
      health: 100,
      armor: 0,
      money: 0,
      kills: 0,
      assists: 0,
      deaths: 0,
      equipment: { grenades: [], hasHelmet: false, hasDefuseKit: false, hasBomb: false },
    },
  ],
  observer: { playerSteamId: "A" },
  bomb: { state: "planted", countdown: 20 },
  pause: null,
  worldGrenades: [],
}

describe("realtime store match-reset", () => {
  test("clears runtime match state and keeps config", () => {
    const store = useRealtimeStore.getState()
    store.applyMessage({ type: "theme", data: { ...defaultTheme, accent: "#112233" } })
    store.applyMessage({ type: "presentation", data: emptyPlayerPresentationConfig })
    store.applyMessage({
      type: "broadcast-config",
      data: {
        ...defaultBroadcastConfig,
        format: "BO3",
        teams: { left: { name: "SquadVault" }, right: { name: "Velos" } },
      },
    })
    store.applyMessage({ type: "snapshot", data: sample })
    store.applyMessage({ type: "event", data: { type: "player_died", steamId: "A" } })
    store.applyMessage({
      type: "interstitial",
      data: {
        card: {
          type: "ace",
          id: "ace:1:A",
          createdAt: 1,
          teamId: "team-1",
          playerSteamId: "A",
          roundKills: 5,
          side: "CT",
        },
        expiresAt: 5000,
      },
    })

    expect(useRealtimeStore.getState().state?.map.name).toBe("de_inferno")
    expect(useRealtimeStore.getState().recentEvents).toHaveLength(1)
    expect(useRealtimeStore.getState().interstitial).not.toBeNull()

    useRealtimeStore.getState().applyMessage({ type: "match-reset" })

    const next = useRealtimeStore.getState()
    expect(next.state).toBeNull()
    expect(next.gameConnected).toBe(false)
    expect(next.recentEvents).toEqual([])
    expect(next.interstitial).toBeNull()
    expect(next.theme.accent).toBe("#112233")
    expect(next.broadcastConfig.teams.left.name).toBe("SquadVault")
    expect(next.presentation).toEqual(emptyPlayerPresentationConfig)
  })
})
