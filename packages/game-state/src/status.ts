import { defaultBroadcastConfig, resolveBroadcastTeam, type BroadcastConfig } from "@workspace/presentation"

import { getDisplayRoundNumber, getRoundDisplayState } from "./selectors"
import type { GameState } from "./types"

/**
 * Idle heartbeat in `apps/server/gsi/gamestate_integration_matchframe.cfg`.
 * Freshness is derived from that value so a single delayed heartbeat stays Live.
 */
export const GSI_HEARTBEAT_MS = 15_000
/** Live while younger than two heartbeats. */
export const GSI_FRESH_MS = GSI_HEARTBEAT_MS * 2
/** Stale until four heartbeats; offline after that. */
export const GSI_STALE_MS = GSI_HEARTBEAT_MS * 4

export type GsiFreshness = "waiting" | "live" | "stale" | "offline"

export type GsiConnectionStatus = {
  connected: boolean
  stale: boolean
  freshness: GsiFreshness
  ageMs?: number
}

export type RadarSupport = "ready" | "unavailable" | "none"

export type BroadcastReadinessState = "ready" | "warning" | "offline"

export type BroadcastIssueCode =
  | "server_unreachable"
  | "gsi_waiting"
  | "gsi_stale"
  | "overlay_disconnected"
  | "radar_unavailable"

export type BroadcastIssue = {
  code: BroadcastIssueCode
  title: string
  detail: string
}

export type BroadcastStatus = {
  server: {
    healthy: boolean
  }
  gsi: {
    connected: boolean
    lastUpdateAt?: number
    stale: boolean
    freshness: GsiFreshness
  }
  overlay: {
    connectedClients: number
  }
  match: {
    map?: string
    mapId?: string
    phase?: string
    round?: number
    playerCount: number
    leftName?: string
    rightName?: string
    leftScore?: number
    rightScore?: number
    radar: RadarSupport
  }
  readiness: {
    state: BroadcastReadinessState
    issues: readonly BroadcastIssue[]
  }
}

export type BuildBroadcastStatusInput = {
  now: number
  lastGsiUpdateAt?: number
  overlayClientCount: number
  state: GameState | null
  broadcast?: BroadcastConfig
  mapId?: string
  mapDisplayName?: string
  radarSupported: boolean
}

export function getGsiConnectionStatus(
  lastUpdateAt: number | undefined,
  now: number
): GsiConnectionStatus {
  if (lastUpdateAt === undefined) {
    return { connected: false, stale: false, freshness: "waiting" }
  }
  const ageMs = Math.max(0, now - lastUpdateAt)
  if (ageMs < GSI_FRESH_MS) {
    return { connected: true, stale: false, freshness: "live", ageMs }
  }
  if (ageMs < GSI_STALE_MS) {
    return { connected: true, stale: true, freshness: "stale", ageMs }
  }
  return { connected: false, stale: true, freshness: "offline", ageMs }
}

export function operatorPhaseLabel(state: GameState): string {
  const display = getRoundDisplayState(state)
  switch (display.kind) {
    case "freezetime":
      return "FREEZE"
    case "live":
    case "bomb":
      return "LIVE"
    case "over":
      return "ROUND OVER"
    case "paused":
      return "PAUSED"
    case "timeout":
      return "TIMEOUT"
    case "unknown":
      break
  }
  switch (state.map.phase) {
    case "warmup":
      return "WARMUP"
    case "intermission":
      return "INTERMISSION"
    case "gameover":
      return "OVER"
    case "live":
      return "LIVE"
    default:
      return "MATCH"
  }
}

export function formatCompactAge(ageMs: number): string {
  const seconds = Math.floor(Math.max(0, ageMs) / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  return `${Math.floor(seconds / 60)}m`
}

export function gsiOperatorLabel(gsi: GsiConnectionStatus, now: number, lastUpdateAt?: number): string {
  switch (gsi.freshness) {
    case "waiting":
      return "Waiting"
    case "live":
      return "Live"
    case "stale": {
      const age = ageFrom(lastUpdateAt, now, gsi.ageMs)
      return age === undefined ? "Stale" : `Stale · ${formatCompactAge(age)}`
    }
    case "offline": {
      const age = ageFrom(lastUpdateAt, now, gsi.ageMs)
      return age === undefined ? "Last update ago" : `Last update ${formatCompactAge(age)} ago`
    }
  }
}

export function overlayConnectionLabel(connectedClients: number): string {
  if (connectedClients <= 0) {
    return "Not connected"
  }
  if (connectedClients === 1) {
    return "Connected"
  }
  return `${connectedClients} clients`
}

export function sidebarReadinessLabel(status: BroadcastStatus): string {
  if (status.readiness.state === "ready") {
    return "READY"
  }
  if (status.readiness.state === "warning") {
    return "WARNING"
  }
  if (status.readiness.issues.some((issue) => issue.code === "server_unreachable")) {
    return "OFFLINE"
  }
  return "WAITING FOR CS2"
}

export function matchScoreLine(match: BroadcastStatus["match"]): string | undefined {
  if (!match.leftName || !match.rightName) {
    return undefined
  }
  const left = match.leftScore ?? 0
  const right = match.rightScore ?? 0
  return `${match.leftName} ${left}-${right} ${match.rightName}`
}

export function matchContextLine(match: BroadcastStatus["match"]): string | undefined {
  if (!match.map || match.round === undefined || !match.phase) {
    return undefined
  }
  return `${match.map} · R${match.round} · ${match.phase}`
}

export function unreachableBroadcastStatus(): BroadcastStatus {
  return {
    server: { healthy: false },
    gsi: { connected: false, stale: false, freshness: "waiting" },
    overlay: { connectedClients: 0 },
    match: { playerCount: 0, radar: "none" },
    readiness: {
      state: "offline",
      issues: [
        {
          code: "server_unreachable",
          title: "Server unreachable",
          detail: "Start the stack, then refresh.",
        },
      ],
    },
  }
}

export function buildBroadcastStatus(input: BuildBroadcastStatusInput): BroadcastStatus {
  const gsi = getGsiConnectionStatus(input.lastGsiUpdateAt, input.now)
  const overlayClientCount = Math.max(0, Math.trunc(input.overlayClientCount))
  const match = matchSnapshot(input)
  const issues = collectIssues({
    gsi,
    overlayClientCount,
    radar: match.radar,
    mapId: match.mapId,
    lastUpdateAt: input.lastGsiUpdateAt,
    now: input.now,
  })
  const gsiFields: BroadcastStatus["gsi"] = {
    connected: gsi.connected,
    stale: gsi.stale,
    freshness: gsi.freshness,
  }
  if (input.lastGsiUpdateAt !== undefined) {
    gsiFields.lastUpdateAt = input.lastGsiUpdateAt
  }

  return {
    server: { healthy: true },
    gsi: gsiFields,
    overlay: { connectedClients: overlayClientCount },
    match,
    readiness: {
      state: gsi.freshness === "waiting" ? "offline" : issues.length > 0 ? "warning" : "ready",
      issues,
    },
  }
}

export function parseBroadcastStatus(value: unknown): BroadcastStatus | null {
  if (!isRecord(value) || !isRecord(value.server) || typeof value.server.healthy !== "boolean") {
    return null
  }
  if (!isRecord(value.gsi) || !isGsiFreshness(value.gsi.freshness)) {
    return null
  }
  if (typeof value.gsi.connected !== "boolean" || typeof value.gsi.stale !== "boolean") {
    return null
  }
  if (value.gsi.lastUpdateAt !== undefined && typeof value.gsi.lastUpdateAt !== "number") {
    return null
  }
  if (!isRecord(value.overlay) || typeof value.overlay.connectedClients !== "number") {
    return null
  }
  if (!isRecord(value.match) || typeof value.match.playerCount !== "number" || !isRadarSupport(value.match.radar)) {
    return null
  }
  if (!isRecord(value.readiness) || !isReadinessState(value.readiness.state) || !Array.isArray(value.readiness.issues)) {
    return null
  }
  const issues: BroadcastIssue[] = []
  for (const issue of value.readiness.issues) {
    const parsed = parseIssue(issue)
    if (!parsed) {
      return null
    }
    issues.push(parsed)
  }

  const gsi: BroadcastStatus["gsi"] = {
    connected: value.gsi.connected,
    stale: value.gsi.stale,
    freshness: value.gsi.freshness,
  }
  if (typeof value.gsi.lastUpdateAt === "number") {
    gsi.lastUpdateAt = value.gsi.lastUpdateAt
  }

  return {
    server: { healthy: value.server.healthy },
    gsi,
    overlay: { connectedClients: value.overlay.connectedClients },
    match: {
      playerCount: value.match.playerCount,
      radar: value.match.radar,
      ...(typeof value.match.map === "string" ? { map: value.match.map } : {}),
      ...(typeof value.match.mapId === "string" ? { mapId: value.match.mapId } : {}),
      ...(typeof value.match.phase === "string" ? { phase: value.match.phase } : {}),
      ...(typeof value.match.round === "number" ? { round: value.match.round } : {}),
      ...(typeof value.match.leftName === "string" ? { leftName: value.match.leftName } : {}),
      ...(typeof value.match.rightName === "string" ? { rightName: value.match.rightName } : {}),
      ...(typeof value.match.leftScore === "number" ? { leftScore: value.match.leftScore } : {}),
      ...(typeof value.match.rightScore === "number" ? { rightScore: value.match.rightScore } : {}),
    },
    readiness: {
      state: value.readiness.state,
      issues,
    },
  }
}

function matchSnapshot(input: BuildBroadcastStatusInput): BroadcastStatus["match"] {
  const state = input.state
  if (!state) {
    return { playerCount: 0, radar: "none" }
  }

  const mapId = input.mapId?.trim() || undefined
  const radar: RadarSupport = !mapId ? "none" : input.radarSupported ? "ready" : "unavailable"
  const config = input.broadcast ?? defaultBroadcastConfig
  const left = resolveBroadcastTeam(state.teams, config, "left")
  const right = resolveBroadcastTeam(state.teams, config, "right")

  const match: BroadcastStatus["match"] = {
    playerCount: state.players.length,
    radar,
    phase: operatorPhaseLabel(state),
    round: getDisplayRoundNumber(state),
    leftName: left.displayName,
    rightName: right.displayName,
    leftScore: left.score,
    rightScore: right.score,
  }
  if (mapId) {
    match.mapId = mapId
    match.map = input.mapDisplayName?.trim() || mapId
  }
  return match
}

function collectIssues(input: {
  gsi: GsiConnectionStatus
  overlayClientCount: number
  radar: RadarSupport
  mapId?: string
  lastUpdateAt?: number
  now: number
}): BroadcastIssue[] {
  const issues: BroadcastIssue[] = []
  if (input.gsi.freshness === "waiting") {
    issues.push({
      code: "gsi_waiting",
      title: "Waiting for CS2",
      detail: "Spectator / GOTV, or send a fixture.",
    })
  } else if (input.gsi.freshness === "stale" || input.gsi.freshness === "offline") {
    const age = ageFrom(input.lastUpdateAt, input.now, input.gsi.ageMs) ?? 0
    issues.push({
      code: "gsi_stale",
      title: "CS2 data is stale",
      detail: `No GSI update for ${formatIssueAge(age)}.`,
    })
  }
  if (input.overlayClientCount <= 0) {
    issues.push({
      code: "overlay_disconnected",
      title: "Overlay not connected",
      detail: "Open the OBS browser source.",
    })
  }
  if (input.radar === "unavailable") {
    const mapId = input.mapId ?? "this map"
    issues.push({
      code: "radar_unavailable",
      title: "Radar unavailable",
      detail: `${mapId} is not supported yet.`,
    })
  }
  return issues.slice(0, 3)
}

function formatIssueAge(ageMs: number): string {
  const seconds = Math.floor(Math.max(0, ageMs) / 1000)
  if (seconds < 60) {
    return seconds === 1 ? "1 second" : `${seconds} seconds`
  }
  const minutes = Math.floor(seconds / 60)
  return minutes === 1 ? "1 minute" : `${minutes} minutes`
}

function ageFrom(lastUpdateAt: number | undefined, now: number, ageMs?: number): number | undefined {
  if (lastUpdateAt !== undefined) {
    return Math.max(0, now - lastUpdateAt)
  }
  return ageMs
}

function parseIssue(value: unknown): BroadcastIssue | null {
  if (!isRecord(value) || !isIssueCode(value.code)) {
    return null
  }
  if (typeof value.title !== "string" || typeof value.detail !== "string") {
    return null
  }
  return { code: value.code, title: value.title, detail: value.detail }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isGsiFreshness(value: unknown): value is GsiFreshness {
  return value === "waiting" || value === "live" || value === "stale" || value === "offline"
}

function isRadarSupport(value: unknown): value is RadarSupport {
  return value === "ready" || value === "unavailable" || value === "none"
}

function isReadinessState(value: unknown): value is BroadcastReadinessState {
  return value === "ready" || value === "warning" || value === "offline"
}

function isIssueCode(value: unknown): value is BroadcastIssueCode {
  return (
    value === "server_unreachable" ||
    value === "gsi_waiting" ||
    value === "gsi_stale" ||
    value === "overlay_disconnected" ||
    value === "radar_unavailable"
  )
}
