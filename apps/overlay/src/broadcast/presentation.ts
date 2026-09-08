import type {
  GameState,
  PlayerState,
  RoundWinReason,
  Side,
} from "@workspace/game-state"
import { getRoundDisplayState } from "@workspace/game-state"
import { overlayTeamName, type OverlayConfig } from "@workspace/presentation"

/**
 * Overlay show states. Derived from GameState; not a protocol change.
 *
 * | phase        | header | radar | rows | focused | result | history | interstitial |
 * | live         | on     | on    | on   | on      | off    | off     | off          |
 * | freeze       | on     | on    | on   | on      | off    | on      | off          |
 * | planted      | on     | on    | on   | on      | off    | off     | off          |
 * | defusing     | on     | on    | on   | on      | off    | off     | off          |
 * | round_over   | on     | on    | on   | if no interstitial | on | on | optional MVP |
 * | paused       | on     | on    | on   | on      | off    | on      | off (future pause card) |
 * | timeout      | on     | on    | on   | on      | off    | on      | off (future timeout card) |
 *
 * Result lives in the header center well — no second banner.
 * Interstitial replaces the focused-player slot so they never overlap.
 */
export type OverlayPhase =
  | "live"
  | "freeze"
  | "planted"
  | "defusing"
  | "round_over"
  | "paused"
  | "timeout"

export type OverlayChrome = {
  radar: boolean
  header: boolean
  teams: boolean
  focused: boolean
  result: boolean
  history: boolean
  interstitial: boolean
}

export type BrandingSlotId = "event" | "stage" | "sponsor" | "series"

export type BrandingSlot = {
  id: BrandingSlotId
  text?: string
  imageUrl?: string
}

export type OverlayBranding = {
  eventName?: string
  eventImageUrl?: string
  stage?: string
  sponsorName?: string
  sponsorImageUrl?: string
  seriesLabel?: string
  leftName?: string
  rightName?: string
  teamImages?: Readonly<Record<string, string>>
}

export type InterstitialKind = "mvp" | "ace" | "clutch" | "watch" | "timeout" | "pause"

export type InterstitialModel = {
  kind: InterstitialKind
  headline: string
  kicker?: string
  playerSteamId?: string
  playerName?: string
  teamId?: string
  teamName?: string
  side?: Side
  detail?: string
  statLabel?: string
  statValue?: string
}

export type SeriesLength = 1 | 3 | 5 | 7

export type SeriesFormat = {
  length: SeriesLength
  winsNeeded: number
}

export type OverlayShow = {
  phase: OverlayPhase
  branding: OverlayBranding
  slots: readonly BrandingSlot[]
  series?: SeriesFormat
  interstitial: InterstitialModel | null
  chrome: OverlayChrome
}

export function getOverlayPhase(state: GameState): OverlayPhase {
  const kind = getRoundDisplayState(state).kind
  if (kind === "over") {
    return "round_over"
  }
  if (kind === "paused") {
    return "paused"
  }
  if (kind === "timeout") {
    return "timeout"
  }
  if (kind === "freezetime") {
    return "freeze"
  }
  if (kind === "bomb") {
    return state.bomb?.state === "defusing" ? "defusing" : "planted"
  }
  return "live"
}

export function overlayShow(state: GameState, branding: OverlayBranding): OverlayShow {
  const phase = getOverlayPhase(state)
  const interstitial = pickInterstitial(state, phase, branding)
  const series = parseSeriesFormat(branding.seriesLabel)
  return {
    phase,
    branding,
    slots: brandingSlots(branding),
    ...(series ? { series } : {}),
    interstitial,
    chrome: {
      radar: true,
      header: true,
      teams: true,
      focused: interstitial === null,
      result: phase === "round_over",
      history:
        phase === "freeze" ||
        phase === "round_over" ||
        phase === "paused" ||
        phase === "timeout",
      interstitial: interstitial !== null,
    },
  }
}

export function parseSeriesFormat(label: string | undefined): SeriesFormat | undefined {
  if (!label) {
    return undefined
  }
  const compact = label.trim().toUpperCase().replace(/[\s-]+/g, "")
  const match = /^(?:BO|BESTOF)?([1357])$/.exec(compact)
  const length = match ? Number(match[1]) : undefined
  if (length !== 1 && length !== 3 && length !== 5 && length !== 7) {
    return undefined
  }
  return { length, winsNeeded: (length + 1) / 2 }
}

/** One boolean per map slot. Undefined when the series has no pip rail (BO1 / unknown). */
export function seriesSlots(
  format: SeriesFormat | undefined,
  wins: number | undefined
): readonly boolean[] | undefined {
  if (!format || format.length < 3) {
    return undefined
  }
  const filled = Math.min(format.winsNeeded, Math.max(0, wins ?? 0))
  return Array.from({ length: format.winsNeeded }, (_, index) => index < filled)
}

export function parseOverlayBranding(search: string): OverlayBranding {
  const params = new URLSearchParams(stripQuery(search))
  return {
    eventName: params.has("event") ? blank(params.get("event")) : "Matchframe",
    ...(url(params.get("eventImage")) ? { eventImageUrl: url(params.get("eventImage")) } : {}),
    ...(blank(params.get("stage")) ? { stage: blank(params.get("stage")) } : {}),
    ...(blank(params.get("sponsor")) ? { sponsorName: blank(params.get("sponsor")) } : {}),
    ...(url(params.get("sponsorImage")) ? { sponsorImageUrl: url(params.get("sponsorImage")) } : {}),
    ...(blank(params.get("series")) ? { seriesLabel: blank(params.get("series")) } : {}),
  }
}

/** Dashboard overlay config is the series and team-name source. A URL `series` still wins when present. */
export function applyOverlayConfig(
  branding: OverlayBranding,
  overlay: OverlayConfig
): OverlayBranding {
  return {
    ...branding,
    seriesLabel: branding.seriesLabel ?? overlay.series,
    ...(overlay.leftName ? { leftName: overlay.leftName } : {}),
    ...(overlay.rightName ? { rightName: overlay.rightName } : {}),
  }
}

export function teamBroadcastName(
  teams: readonly { id: string; name: string }[],
  teamId: string | undefined,
  branding: OverlayBranding
): string | undefined {
  if (!teamId) {
    return undefined
  }
  const index = teams.findIndex((team) => team.id === teamId)
  const team = teams[index]
  if (!team) {
    return undefined
  }
  return overlayTeamName(branding, index === 0 ? "left" : "right", team.name)
}

export function brandingSlots(branding: OverlayBranding): BrandingSlot[] {
  const slots: BrandingSlot[] = []
  pushSlot(slots, "event", branding.eventName, branding.eventImageUrl)
  pushSlot(slots, "stage", branding.stage)
  pushSlot(slots, "sponsor", branding.sponsorName, branding.sponsorImageUrl)
  const format = parseSeriesFormat(branding.seriesLabel)
  pushSlot(slots, "series", format && format.length > 1 ? branding.seriesLabel : undefined)
  return slots
}

export function pickInterstitial(
  state: GameState,
  phase: OverlayPhase,
  branding: OverlayBranding = {}
): InterstitialModel | null {
  if (phase !== "round_over") {
    return null
  }
  return mvpFromMatchKills(state, branding)
}

export function portraitInitials(name: string, number?: number): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return number !== undefined ? String(number) : "?"
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]?.[0]
    const second = parts[1]?.[0]
    if (first && second) {
      return `${first}${second}`.toUpperCase()
    }
  }
  const compact = trimmed.replace(/[^a-zA-Z0-9]/g, "")
  if (compact.length >= 2) {
    return compact.slice(0, 2).toUpperCase()
  }
  if (compact.length === 1) {
    return compact.toUpperCase()
  }
  return number !== undefined ? String(number) : "?"
}

export function formatWinReason(reason: RoundWinReason | undefined): string | undefined {
  if (reason === "elimination") {
    return "ELIMINATION"
  }
  if (reason === "bomb_exploded") {
    return "BOMB"
  }
  if (reason === "bomb_defused") {
    return "DEFUSED"
  }
  if (reason === "time_expired") {
    return "TIME"
  }
  return undefined
}

/**
 * ponytail: match K/D, not round kills. Round-stat tracking is the upgrade
 * when GSI/engine exposes per-round player stats.
 */
function mvpFromMatchKills(state: GameState, branding: OverlayBranding): InterstitialModel | null {
  const display = getRoundDisplayState(state)
  const teamId = display.winnerTeamId
  if (!teamId || !display.winTeam) {
    return null
  }
  const roster = state.players.filter((player) => player.teamId === teamId)
  const player = roster.reduce<PlayerState | undefined>((best, next) => {
    if (!best) {
      return next
    }
    if (next.kills !== best.kills) {
      return next.kills > best.kills ? next : best
    }
    if (next.assists !== best.assists) {
      return next.assists > best.assists ? next : best
    }
    return next.deaths < best.deaths ? next : best
  }, undefined)
  if (!player) {
    return null
  }
  const teamName = teamBroadcastName(state.teams, teamId, branding)
  return {
    kind: "mvp",
    headline: "MVP",
    kicker: `Round ${display.round}`,
    playerSteamId: player.steamId,
    playerName: player.name || player.steamId,
    teamId,
    ...(teamName ? { teamName } : {}),
    side: player.side,
    detail: formatWinReason(display.winReason),
    statLabel: "K",
    statValue: String(player.kills),
  }
}

function pushSlot(
  slots: BrandingSlot[],
  id: BrandingSlotId,
  text?: string,
  imageUrl?: string
): void {
  if (!text && !imageUrl) {
    return
  }
  slots.push({
    id,
    ...(text ? { text } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  })
}

function stripQuery(search: string): string {
  return search.startsWith("?") ? search.slice(1) : search
}

function blank(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function url(value: string | null): string | undefined {
  const trimmed = blank(value)
  if (!trimmed) {
    return undefined
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("./")) {
    return trimmed
  }
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined
  } catch {
    return undefined
  }
}
