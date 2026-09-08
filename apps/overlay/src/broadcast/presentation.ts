import type {
  GameState,
  PlayerState,
  RoundWinReason,
  Side,
} from "@workspace/game-state"
import { getRoundDisplayState } from "@workspace/game-state"

/**
 * Overlay show states. Derived from GameState; not a protocol change.
 *
 * | phase        | header | radar | rows | focused | result well | interstitial |
 * | live         | on     | on    | on   | on      | off         | off          |
 * | freeze       | on     | on    | on   | on      | off         | off          |
 * | planted      | on     | on    | on   | on      | off         | off          |
 * | defusing     | on     | on    | on   | on      | off         | off          |
 * | round_over   | on     | on    | on   | if no interstitial | on | optional MVP |
 * | paused       | on     | on    | on   | on      | off         | off (future pause card) |
 * | timeout      | on     | on    | on   | on      | off         | off (future timeout card) |
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

export type OverlayShow = {
  phase: OverlayPhase
  branding: OverlayBranding
  slots: readonly BrandingSlot[]
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
  const interstitial = pickInterstitial(state, phase)
  return {
    phase,
    branding,
    slots: brandingSlots(branding),
    interstitial,
    chrome: {
      radar: true,
      header: true,
      teams: true,
      focused: interstitial === null,
      result: phase === "round_over",
      interstitial: interstitial !== null,
    },
  }
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

export function brandingSlots(branding: OverlayBranding): BrandingSlot[] {
  const slots: BrandingSlot[] = []
  pushSlot(slots, "event", branding.eventName, branding.eventImageUrl)
  pushSlot(slots, "stage", branding.stage)
  pushSlot(slots, "sponsor", branding.sponsorName, branding.sponsorImageUrl)
  pushSlot(slots, "series", branding.seriesLabel)
  return slots
}

export function pickInterstitial(state: GameState, phase: OverlayPhase): InterstitialModel | null {
  if (phase !== "round_over") {
    return null
  }
  return mvpFromMatchKills(state)
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
function mvpFromMatchKills(state: GameState): InterstitialModel | null {
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
  const team = state.teams.find((entry) => entry.id === teamId)
  return {
    kind: "mvp",
    headline: "MVP",
    kicker: `Round ${display.round}`,
    playerSteamId: player.steamId,
    playerName: player.name || player.steamId,
    teamId,
    ...(team ? { teamName: team.name } : {}),
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
