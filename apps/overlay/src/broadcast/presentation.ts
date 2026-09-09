import type {
  GameState,
  PlayerState,
  RoundWinReason,
  Side,
} from "@workspace/game-state"
import { getRoundDisplayState } from "@workspace/game-state"
import { broadcastSponsors, resolveBroadcastTeam, resolveSponsorContent } from "@workspace/presentation"
import type {
  BroadcastConfig,
  SponsorDisplayMode,
  SponsorPosition,
} from "@workspace/presentation"

import { getBroadcastAsset } from "../assets/broadcast"

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

export type BrandingSlotId = "event" | "stage" | "series"

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
  leftLogoUrl?: string
  rightLogoUrl?: string
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

export type OverlaySponsorView = {
  position: SponsorPosition
  displayMode: SponsorDisplayMode
  name?: string
  imageUrl?: string
  showLogo: boolean
  showText: boolean
}

export type OverlayShow = {
  phase: OverlayPhase
  branding: OverlayBranding
  broadcast: BroadcastConfig
  slots: readonly BrandingSlot[]
  sponsors: readonly OverlaySponsorView[]
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

export function overlayShow(
  state: GameState,
  branding: OverlayBranding,
  broadcast: BroadcastConfig
): OverlayShow {
  const phase = getOverlayPhase(state)
  const interstitial = pickInterstitial(state, phase, broadcast)
  const series = parseSeriesFormat(branding.seriesLabel ?? broadcast.format)
  const sponsors = overlaySponsors(branding, broadcast)
  return {
    phase,
    branding,
    broadcast,
    slots: brandingSlots(branding),
    sponsors,
    ...(series && series.length > 1 ? { series } : {}),
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
    ...(params.has("event") ? { eventName: blank(params.get("event")) } : {}),
    ...(url(params.get("eventImage")) ? { eventImageUrl: url(params.get("eventImage")) } : {}),
    ...(blank(params.get("stage")) ? { stage: blank(params.get("stage")) } : {}),
    ...(blank(params.get("sponsor")) ? { sponsorName: blank(params.get("sponsor")) } : {}),
    ...(url(params.get("sponsorImage")) ? { sponsorImageUrl: url(params.get("sponsorImage")) } : {}),
    ...(blank(params.get("series")) ? { seriesLabel: blank(params.get("series")) } : {}),
  }
}

/** Dashboard broadcast config is the series and team source. A URL `series` still wins when present. */
export function applyBroadcastConfig(
  branding: OverlayBranding,
  config: BroadcastConfig
): OverlayBranding {
  const left = config.teams?.left ?? {}
  const right = config.teams?.right ?? {}
  const leftLogo = left.logoAssetId ? getBroadcastAsset(left.logoAssetId) : undefined
  const rightLogo = right.logoAssetId ? getBroadcastAsset(right.logoAssetId) : undefined
  const first = broadcastSponsors(config)[0]
  const sponsorImage = first?.assetId ? getBroadcastAsset(first.assetId) : undefined
  return {
    ...branding,
    eventName: branding.eventName ?? config.event?.name,
    stage: branding.stage ?? config.event?.stage,
    sponsorName: branding.sponsorName ?? first?.name,
    sponsorImageUrl: branding.sponsorImageUrl ?? sponsorImage,
    seriesLabel: branding.seriesLabel ?? config.format,
    ...(left.name ? { leftName: left.name } : {}),
    ...(right.name ? { rightName: right.name } : {}),
    ...(leftLogo ? { leftLogoUrl: leftLogo } : {}),
    ...(rightLogo ? { rightLogoUrl: rightLogo } : {}),
  }
}

export const applyOverlayConfig = applyBroadcastConfig

export function overlaySponsors(
  branding: OverlayBranding,
  config: BroadcastConfig
): OverlaySponsorView[] {
  const configured = broadcastSponsors(config)
  if (configured.length === 0) {
    const fromUrl = sponsorView({
      enabled: Boolean(branding.sponsorName || branding.sponsorImageUrl),
      name: branding.sponsorName,
      imageUrl: branding.sponsorImageUrl,
      displayMode: "logo-text",
      position: "top-right",
    })
    return fromUrl ? [fromUrl] : []
  }
  return configured.flatMap((sponsor) => {
    const view = sponsorView({
      enabled: sponsor.enabled,
      name: sponsor.name,
      imageUrl: sponsor.assetId ? getBroadcastAsset(sponsor.assetId) : undefined,
      displayMode: sponsor.displayMode,
      position: sponsor.position,
    })
    return view ? [view] : []
  })
}

export function overlaySponsor(
  branding: OverlayBranding,
  config: BroadcastConfig
): OverlaySponsorView | undefined {
  return overlaySponsors(branding, config)[0]
}

function sponsorView(input: {
  enabled: boolean
  name?: string
  imageUrl?: string
  displayMode: SponsorDisplayMode
  position: SponsorPosition
}): OverlaySponsorView | undefined {
  if (!input.enabled) {
    return undefined
  }
  const name = input.name?.trim()
  const imageUrl = input.imageUrl
  const content = resolveSponsorContent(input.displayMode, {
    name,
    hasLogo: Boolean(imageUrl),
  })
  if (!content) {
    return undefined
  }
  return {
    position: input.position,
    displayMode: input.displayMode,
    ...content,
    ...(name ? { name } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  }
}

export function teamBroadcastName(
  teams: readonly { id: string; name: string; side: "CT" | "T"; score: number }[],
  teamId: string | undefined,
  config: BroadcastConfig
): string | undefined {
  if (!teamId) {
    return undefined
  }
  const index = teams.findIndex((team) => team.id === teamId)
  if (index < 0) {
    return undefined
  }
  return resolveBroadcastTeam(teams, config, index === 0 ? "left" : "right").displayName
}

export function brandingSlots(branding: OverlayBranding): BrandingSlot[] {
  const slots: BrandingSlot[] = []
  pushSlot(slots, "event", branding.eventName, branding.eventImageUrl)
  pushSlot(slots, "stage", branding.stage)
  const format = parseSeriesFormat(branding.seriesLabel)
  pushSlot(slots, "series", format && format.length > 1 ? branding.seriesLabel : undefined)
  return slots
}

export function pickInterstitial(
  state: GameState,
  phase: OverlayPhase,
  config: BroadcastConfig
): InterstitialModel | null {
  if (phase !== "round_over") {
    return null
  }
  return mvpFromMatchKills(state, config)
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
function mvpFromMatchKills(state: GameState, config: BroadcastConfig): InterstitialModel | null {
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
  const teamName = teamBroadcastName(state.teams, teamId, config)
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
