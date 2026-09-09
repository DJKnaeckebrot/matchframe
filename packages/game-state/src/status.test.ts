import { describe, expect, test } from "bun:test"
import { defaultBroadcastConfig, type BroadcastConfig } from "@workspace/presentation"

import type { GameState } from "./types"
import {
  GSI_FRESH_MS,
  GSI_STALE_MS,
  buildBroadcastStatus,
  getGsiConnectionStatus,
  gsiOperatorLabel,
  matchContextLine,
  matchScoreLine,
  operatorPhaseLabel,
  overlayConnectionLabel,
  parseBroadcastStatus,
  sidebarReadinessLabel,
  unreachableBroadcastStatus,
} from "./status"

const NOW = 1_000_000

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    timestamp: NOW,
    map: { name: "de_mirage", phase: "live", round: 24, roundHistory: [] },
    round: { phase: "live", winTeam: null, alive: { ct: 5, t: 5 } },
    teams: [
      { id: "team-1", name: "Northwind", side: "CT", score: 12, seriesWins: 0 },
      { id: "team-2", name: "Redline", side: "T", score: 12, seriesWins: 0 },
    ],
    players: [
      player("A", "team-1", "CT"),
      player("B", "team-1", "CT"),
      player("C", "team-2", "T"),
    ],
    observer: { playerSteamId: null },
    bomb: null,
    pause: null,
    worldGrenades: [],
    ...overrides,
  }
}

function player(steamId: string, teamId: string, side: "CT" | "T") {
  return {
    steamId,
    name: steamId,
    teamId,
    side,
    alive: true,
    health: 100,
    armor: 0,
    money: 0,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: {
      grenades: [],
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
    },
  }
}

function status(overrides: Partial<Parameters<typeof buildBroadcastStatus>[0]> = {}) {
  return buildBroadcastStatus({
    now: NOW,
    overlayClientCount: 1,
    state: state(),
    broadcast: defaultBroadcastConfig,
    mapId: "de_mirage",
    mapDisplayName: "Mirage",
    radarSupported: true,
    lastGsiUpdateAt: NOW - 1_000,
    ...overrides,
  })
}

describe("getGsiConnectionStatus", () => {
  test("never received GSI is waiting", () => {
    expect(getGsiConnectionStatus(undefined, NOW)).toEqual({
      connected: false,
      stale: false,
      freshness: "waiting",
    })
  })

  test("fresh GSI is live", () => {
    expect(getGsiConnectionStatus(NOW - 4_000, NOW)).toEqual({
      connected: true,
      stale: false,
      freshness: "live",
      ageMs: 4_000,
    })
    expect(getGsiConnectionStatus(NOW - (GSI_FRESH_MS - 1), NOW).freshness).toBe("live")
  })

  test("stale GSI is still connected", () => {
    const result = getGsiConnectionStatus(NOW - GSI_FRESH_MS, NOW)
    expect(result).toEqual({
      connected: true,
      stale: true,
      freshness: "stale",
      ageMs: GSI_FRESH_MS,
    })
    expect(getGsiConnectionStatus(NOW - (GSI_STALE_MS - 1), NOW).freshness).toBe("stale")
  })

  test("offline GSI is disconnected after the stale window", () => {
    expect(getGsiConnectionStatus(NOW - GSI_STALE_MS, NOW)).toEqual({
      connected: false,
      stale: true,
      freshness: "offline",
      ageMs: GSI_STALE_MS,
    })
  })
})

describe("gsiOperatorLabel", () => {
  test("uses operator language, not ingest jargon", () => {
    expect(gsiOperatorLabel(getGsiConnectionStatus(undefined, NOW), NOW)).toBe("Waiting")
    expect(gsiOperatorLabel(getGsiConnectionStatus(NOW - 200, NOW), NOW, NOW - 200)).toBe("Live")
    expect(gsiOperatorLabel(getGsiConnectionStatus(NOW - 21_000, NOW), NOW, NOW - 21_000)).toBe(
      "Stale · 21s"
    )
    expect(
      gsiOperatorLabel(getGsiConnectionStatus(NOW - 120_000, NOW), NOW, NOW - 120_000)
    ).toBe("Last update 2m ago")
  })
})

describe("buildBroadcastStatus", () => {
  test("never received GSI is offline and waiting", () => {
    const built = status({ lastGsiUpdateAt: undefined, overlayClientCount: 0, state: null })
    expect(built.server.healthy).toBe(true)
    expect(built.gsi).toEqual({ connected: false, stale: false, freshness: "waiting" })
    expect(built.overlay.connectedClients).toBe(0)
    expect(built.match).toEqual({ playerCount: 0, radar: "none" })
    expect(built.readiness.state).toBe("offline")
    expect(built.readiness.issues.map((issue) => issue.code)).toEqual([
      "gsi_waiting",
      "overlay_disconnected",
    ])
    expect(sidebarReadinessLabel(built)).toBe("WAITING FOR CS2")
  })

  test("fresh GSI with an overlay client is ready", () => {
    const built = status()
    expect(built.gsi.freshness).toBe("live")
    expect(built.overlay.connectedClients).toBe(1)
    expect(built.match.playerCount).toBe(3)
    expect(built.match.map).toBe("Mirage")
    expect(built.match.round).toBe(25)
    expect(built.match.phase).toBe("LIVE")
    expect(built.match.radar).toBe("ready")
    expect(built.readiness).toEqual({ state: "ready", issues: [] })
    expect(sidebarReadinessLabel(built)).toBe("READY")
    expect(overlayConnectionLabel(built.overlay.connectedClients)).toBe("Connected")
  })

  test("zero overlay clients is a warning, not offline", () => {
    const built = status({ overlayClientCount: 0 })
    expect(built.readiness.state).toBe("warning")
    expect(built.readiness.issues).toEqual([
      {
        code: "overlay_disconnected",
        title: "Overlay not connected",
        detail: "Open the OBS browser source.",
      },
    ])
    expect(overlayConnectionLabel(0)).toBe("Not connected")
    expect(overlayConnectionLabel(2)).toBe("2 clients")
  })

  test("stale GSI is a warning with elapsed time", () => {
    const lastUpdateAt = NOW - 21_000
    const built = status({ lastGsiUpdateAt: lastUpdateAt })
    expect(built.gsi.connected).toBe(true)
    expect(built.gsi.stale).toBe(true)
    expect(built.readiness.state).toBe("warning")
    expect(built.readiness.issues[0]).toEqual({
      code: "gsi_stale",
      title: "CS2 data is stale",
      detail: "No GSI update for 21 seconds.",
    })
  })

  test("offline GSI that once arrived stays a warning", () => {
    const built = status({ lastGsiUpdateAt: NOW - 120_000 })
    expect(built.gsi.freshness).toBe("offline")
    expect(built.readiness.state).toBe("warning")
    expect(built.readiness.issues[0]?.detail).toBe("No GSI update for 2 minutes.")
  })

  test("supported radar map is ready", () => {
    expect(status().match.radar).toBe("ready")
    expect(status().readiness.issues.some((issue) => issue.code === "radar_unavailable")).toBe(false)
  })

  test("unsupported radar map is a warning", () => {
    const built = status({
      state: state({ map: { name: "de_cache", phase: "live", round: 4, roundHistory: [] } }),
      mapId: "de_cache",
      mapDisplayName: "de_cache",
      radarSupported: false,
    })
    expect(built.match.radar).toBe("unavailable")
    expect(built.match.map).toBe("de_cache")
    expect(built.readiness.state).toBe("warning")
    expect(built.readiness.issues).toContainEqual({
      code: "radar_unavailable",
      title: "Radar unavailable",
      detail: "de_cache is not supported yet.",
    })
  })

  test("configured team names win over GSI names", () => {
    const broadcast: BroadcastConfig = {
      ...defaultBroadcastConfig,
      teams: { left: { name: "SquadVault" }, right: { name: "Velos" } },
    }
    const built = status({ broadcast })
    expect(built.match.leftName).toBe("SquadVault")
    expect(built.match.rightName).toBe("Velos")
    expect(matchScoreLine(built.match)).toBe("SquadVault 12-12 Velos")
  })

  test("GSI team names are the fallback", () => {
    const built = status()
    expect(built.match.leftName).toBe("Northwind")
    expect(built.match.rightName).toBe("Redline")
    expect(matchScoreLine(built.match)).toBe("Northwind 12-12 Redline")
    expect(matchContextLine(built.match)).toBe("Mirage · R25 · LIVE")
  })

  test("player count is the live roster, not a 5v5 assumption", () => {
    expect(status().match.playerCount).toBe(3)
    expect(status({ state: state({ players: [] }) }).match.playerCount).toBe(0)
  })

  test("missing logos or sponsors are not readiness issues", () => {
    const built = status({
      broadcast: {
        ...defaultBroadcastConfig,
        teams: { left: {}, right: {} },
        sponsors: [],
      },
    })
    expect(built.readiness.state).toBe("ready")
    expect(built.readiness.issues).toEqual([])
  })

  test("left and right names stay on their slots after a side switch", () => {
    const swapped = state({
      teams: [
        { id: "team-1", name: "Northwind", side: "T", score: 13, seriesWins: 0 },
        { id: "team-2", name: "Redline", side: "CT", score: 12, seriesWins: 0 },
      ],
    })
    const broadcast: BroadcastConfig = {
      ...defaultBroadcastConfig,
      teams: { left: { name: "SquadVault" }, right: { name: "Velos" } },
    }
    const built = status({ state: swapped, broadcast })
    expect(built.match.leftName).toBe("SquadVault")
    expect(built.match.rightName).toBe("Velos")
    expect(built.match.leftScore).toBe(13)
    expect(built.match.rightScore).toBe(12)
  })
})

describe("operatorPhaseLabel", () => {
  test("uses normalized Matchframe phases", () => {
    expect(operatorPhaseLabel(state({ round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 } } }))).toBe(
      "FREEZE"
    )
    expect(operatorPhaseLabel(state())).toBe("LIVE")
    expect(operatorPhaseLabel(state({ round: { phase: "over", winTeam: "CT", alive: { ct: 1, t: 0 } } }))).toBe(
      "ROUND OVER"
    )
    expect(operatorPhaseLabel(state({ pause: { kind: "paused" } }))).toBe("PAUSED")
    expect(operatorPhaseLabel(state({ pause: { kind: "timeout", side: "CT" } }))).toBe("TIMEOUT")
  })
})

describe("unreachableBroadcastStatus", () => {
  test("server down is offline", () => {
    const built = unreachableBroadcastStatus()
    expect(built.server.healthy).toBe(false)
    expect(built.readiness.state).toBe("offline")
    expect(sidebarReadinessLabel(built)).toBe("OFFLINE")
  })
})

describe("parseBroadcastStatus", () => {
  test("round-trips a sanitized status payload", () => {
    const built = status()
    expect(parseBroadcastStatus(JSON.parse(JSON.stringify(built)))).toEqual(built)
  })

  test("rejects invalid payloads", () => {
    expect(parseBroadcastStatus(null)).toBeNull()
    expect(parseBroadcastStatus({ server: { healthy: true } })).toBeNull()
  })
})
