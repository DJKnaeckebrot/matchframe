import { z } from "zod"

import { localAssetIdSchema } from "./schema"

export const SERIES_LABELS = ["BO1", "BO3", "BO5", "BO7"] as const

export type SeriesLabel = (typeof SERIES_LABELS)[number]

export type BroadcastTeamSlot = "left" | "right"

export type BroadcastTeamConfig = {
  name?: string
  logoAssetId?: string
}

export type BroadcastSeriesScore = {
  leftMapsWon: number
  rightMapsWon: number
}

export type BroadcastEventConfig = {
  name?: string
  stage?: string
}

export const SPONSOR_POSITIONS = ["top-right", "center"] as const
export const SPONSOR_DISPLAY_MODES = ["logo", "text", "logo-text"] as const

export type SponsorPosition = (typeof SPONSOR_POSITIONS)[number]
export type SponsorDisplayMode = (typeof SPONSOR_DISPLAY_MODES)[number]

export type BroadcastSponsorConfig = {
  enabled: boolean
  name?: string
  assetId?: string
  position: SponsorPosition
  displayMode: SponsorDisplayMode
}

/** Alias used by overlay/dashboard sponsor presentation. */
export type SponsorConfig = BroadcastSponsorConfig

export type BroadcastSponsorDraft = {
  enabled?: boolean
  name?: string
  assetId?: string
  position?: SponsorPosition
  displayMode?: SponsorDisplayMode
}

export type ResolvedBroadcastSponsor = {
  position: SponsorPosition
  displayMode: SponsorDisplayMode
  name?: string
  assetId?: string
  showLogo: boolean
  showText: boolean
}

export const defaultSponsorConfig: BroadcastSponsorConfig = {
  enabled: false,
  position: "top-right",
  displayMode: "logo-text",
}

export const MAX_SPONSORS = 4

export type BroadcastConfig = {
  format: SeriesLabel
  teams: {
    left: BroadcastTeamConfig
    right: BroadcastTeamConfig
  }
  series: BroadcastSeriesScore
  event?: BroadcastEventConfig
  sponsors?: BroadcastSponsorConfig[]
}

export type OverlayTeamSlot = BroadcastTeamSlot
export type OverlaySeriesWins = { left: number; right: number }
/** @deprecated Use BroadcastConfig. Kept as a parse-time legacy shape. */
export type OverlayConfig = BroadcastConfig

const teamNameSchema = z.string().trim().max(32, "Team name is too long").optional()
const labelSchema = z.string().trim().max(48, "Label is too long").optional()
const mapsWonSchema = z.number().int().min(0).max(4)

const teamConfigSchema = z
  .object({
    name: teamNameSchema,
    logoAssetId: localAssetIdSchema.optional(),
  })
  .strict()

const eventConfigSchema = z
  .object({
    name: labelSchema,
    stage: labelSchema,
  })
  .strict()

const sponsorAssetIdSchema = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => {
    if (!value) {
      return undefined
    }
    return localAssetIdSchema.safeParse(value).success ? value : undefined
  })

const sponsorConfigSchema = z
  .object({
    enabled: z.boolean().optional().catch(undefined),
    name: teamNameSchema,
    assetId: sponsorAssetIdSchema,
    position: z.enum(SPONSOR_POSITIONS).optional().catch("top-right"),
    displayMode: z.enum(SPONSOR_DISPLAY_MODES).optional().catch("logo-text"),
  })
  .strip()

const nestedBroadcastConfigSchema = z
  .object({
    format: z.enum(SERIES_LABELS),
    teams: z
      .object({
        left: teamConfigSchema.default({}),
        right: teamConfigSchema.default({}),
      })
      .default({ left: {}, right: {} }),
    series: z
      .object({
        leftMapsWon: mapsWonSchema.default(0),
        rightMapsWon: mapsWonSchema.default(0),
      })
      .default({ leftMapsWon: 0, rightMapsWon: 0 }),
    event: eventConfigSchema.optional(),
    sponsor: sponsorConfigSchema.optional(),
    sponsors: z.array(sponsorConfigSchema).optional(),
  })
  .strict()

const legacyOverlayConfigSchema = z
  .object({
    series: z.enum(SERIES_LABELS),
    leftName: teamNameSchema,
    rightName: teamNameSchema,
    leftWins: mapsWonSchema.optional(),
    rightWins: mapsWonSchema.optional(),
  })
  .strict()

export const defaultBroadcastConfig: BroadcastConfig = {
  format: "BO1",
  teams: { left: {}, right: {} },
  series: { leftMapsWon: 0, rightMapsWon: 0 },
}

export const defaultOverlayConfig = defaultBroadcastConfig

/** First-to target. BO1 is a single map; the overlay still hides series marks. */
export function getSeriesWinTarget(format: SeriesLabel): number {
  return (Number(format.slice(2)) + 1) / 2
}

/** Visible series marks. BO1 has none. */
export function seriesWinsNeeded(format: SeriesLabel): number {
  return format === "BO1" ? 0 : getSeriesWinTarget(format)
}

export function clampSeriesMapsWon(format: SeriesLabel, value: number): number {
  return clampWins(value, seriesWinsNeeded(format))
}

export function overlaySeriesWins(config: BroadcastConfig): OverlaySeriesWins {
  return {
    left: config.series.leftMapsWon,
    right: config.series.rightMapsWon,
  }
}

export function overlaySeriesWinsChanged(a: BroadcastConfig, b: BroadcastConfig): boolean {
  return (
    a.series.leftMapsWon !== b.series.leftMapsWon ||
    a.series.rightMapsWon !== b.series.rightMapsWon
  )
}

export function compactBroadcastConfig(
  config: Omit<BroadcastConfig, "sponsors"> & {
    sponsor?: BroadcastSponsorDraft
    sponsors?: BroadcastSponsorDraft[]
  }
): BroadcastConfig {
  const left = compactTeam(config.teams.left)
  const right = compactTeam(config.teams.right)
  const event = compactEvent(config.event)
  const sponsors = compactSponsors(sponsorDrafts(config))
  return {
    format: config.format,
    teams: { left, right },
    series: {
      leftMapsWon: clampSeriesMapsWon(config.format, config.series.leftMapsWon),
      rightMapsWon: clampSeriesMapsWon(config.format, config.series.rightMapsWon),
    },
    ...(event ? { event } : {}),
    ...(sponsors ? { sponsors } : {}),
  }
}

export function broadcastSponsors(
  config: Pick<BroadcastConfig, "sponsors"> | undefined | null
): readonly BroadcastSponsorConfig[] {
  return config?.sponsors ?? []
}

export const compactOverlayConfig = compactBroadcastConfig

export function overlayTeamName(
  config: Pick<BroadcastConfig, "teams"> | undefined | null,
  slot: BroadcastTeamSlot,
  fallback: string
): string {
  const override = config?.teams?.[slot]?.name?.trim()
  return override || fallback
}

export type BroadcastTeamSource = {
  id: string
  name: string
  side: "CT" | "T"
  score: number
}

export type ResolvedBroadcastTeam = {
  slot: BroadcastTeamSlot
  teamId?: string
  displayName: string
  logoAssetId?: string
  side?: "CT" | "T"
  score: number
  mapsWon: number
}

export function resolveBroadcastTeam(
  teams: readonly BroadcastTeamSource[],
  config: BroadcastConfig,
  slot: BroadcastTeamSlot
): ResolvedBroadcastTeam {
  const team = slot === "left" ? teams[0] : teams[1]
  const override = config.teams?.[slot] ?? {}
  const name = override.name?.trim()
  const logoAssetId = override.logoAssetId
  const mapsWon =
    slot === "left" ? (config.series?.leftMapsWon ?? 0) : (config.series?.rightMapsWon ?? 0)
  return {
    slot,
    ...(team ? { teamId: team.id, side: team.side } : {}),
    displayName: name || team?.name || (slot === "left" ? "Left" : "Right"),
    ...(logoAssetId ? { logoAssetId } : {}),
    score: team?.score ?? 0,
    mapsWon,
  }
}

export function resolveBroadcastEvent(
  config: BroadcastConfig
): { name?: string; stage?: string } | undefined {
  const name = config.event?.name?.trim()
  const stage = config.event?.stage?.trim()
  if (!name && !stage) {
    return undefined
  }
  return {
    ...(name ? { name } : {}),
    ...(stage ? { stage } : {}),
  }
}

export function resolveSponsorContent(
  displayMode: SponsorDisplayMode,
  input: { name?: string; hasLogo: boolean }
): { showLogo: boolean; showText: boolean } | undefined {
  const hasName = Boolean(input.name?.trim())
  if (displayMode === "logo") {
    if (input.hasLogo) {
      return { showLogo: true, showText: false }
    }
    if (hasName) {
      return { showLogo: false, showText: true }
    }
    return undefined
  }
  if (displayMode === "text") {
    return hasName ? { showLogo: false, showText: true } : undefined
  }
  if (!input.hasLogo && !hasName) {
    return undefined
  }
  return { showLogo: input.hasLogo, showText: hasName }
}

export function sponsorNeedsContent(sponsor: BroadcastSponsorConfig | undefined): boolean {
  if (!sponsor?.enabled) {
    return false
  }
  return !sponsor.name?.trim() && !sponsor.assetId
}

export function resolveBroadcastSponsors(
  config: BroadcastConfig
): ResolvedBroadcastSponsor[] {
  return broadcastSponsors(config).flatMap((sponsor) => {
    const resolved = resolveOneSponsor(sponsor)
    return resolved ? [resolved] : []
  })
}

export function resolveBroadcastSponsor(
  config: BroadcastConfig
): ResolvedBroadcastSponsor | undefined {
  return resolveBroadcastSponsors(config)[0]
}

export function referencedAssetIds(config: BroadcastConfig): readonly string[] {
  const ids: string[] = []
  const left = config.teams.left.logoAssetId
  const right = config.teams.right.logoAssetId
  if (left) {
    ids.push(left)
  }
  if (right) {
    ids.push(right)
  }
  for (const sponsor of broadcastSponsors(config)) {
    if (sponsor.assetId) {
      ids.push(sponsor.assetId)
    }
  }
  return ids
}

export function parseBroadcastConfig(
  raw: unknown
): { success: true; data: BroadcastConfig } | { success: false; error: z.ZodError } {
  if (isLegacyOverlayShape(raw)) {
    const legacy = legacyOverlayConfigSchema.safeParse(raw)
    if (!legacy.success) {
      return legacy
    }
    return { success: true, data: compactBroadcastConfig(fromLegacyOverlay(legacy.data)) }
  }

  const nested = nestedBroadcastConfigSchema.safeParse(raw)
  if (!nested.success) {
    return nested
  }
  return { success: true, data: compactBroadcastConfig(toBroadcastConfig(nested.data)) }
}

export const broadcastConfigSchema: z.ZodType<BroadcastConfig> = z.any().transform((raw, ctx) => {
  const parsed = parseBroadcastConfig(raw)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      })
    }
    return z.NEVER
  }
  return parsed.data
})

export const overlayConfigSchema = broadcastConfigSchema

function toBroadcastConfig(
  value: z.infer<typeof nestedBroadcastConfigSchema>
): BroadcastConfig {
  const sponsors = compactSponsors(sponsorDrafts(value))
  return {
    format: value.format,
    teams: {
      left: value.teams.left,
      right: value.teams.right,
    },
    series: {
      leftMapsWon: value.series.leftMapsWon,
      rightMapsWon: value.series.rightMapsWon,
    },
    ...(value.event ? { event: value.event } : {}),
    ...(sponsors ? { sponsors } : {}),
  }
}

function fromLegacyOverlay(legacy: z.infer<typeof legacyOverlayConfigSchema>): BroadcastConfig {
  return {
    format: legacy.series,
    teams: {
      left: teamFromName(legacy.leftName),
      right: teamFromName(legacy.rightName),
    },
    series: {
      leftMapsWon: legacy.leftWins ?? 0,
      rightMapsWon: legacy.rightWins ?? 0,
    },
  }
}

function isLegacyOverlayShape(raw: unknown): boolean {
  return isRecord(raw) && typeof raw.series === "string" && raw.format === undefined
}

function teamFromName(name: string | undefined): BroadcastTeamConfig {
  const trimmed = name?.trim()
  return trimmed ? { name: trimmed } : {}
}

function compactTeam(team: BroadcastTeamConfig): BroadcastTeamConfig {
  const name = team.name?.trim()
  const logoAssetId = team.logoAssetId
  return {
    ...(name ? { name } : {}),
    ...(logoAssetId ? { logoAssetId } : {}),
  }
}

function compactEvent(event: BroadcastEventConfig | undefined): BroadcastEventConfig | undefined {
  const name = event?.name?.trim()
  const stage = event?.stage?.trim()
  if (!name && !stage) {
    return undefined
  }
  return {
    ...(name ? { name } : {}),
    ...(stage ? { stage } : {}),
  }
}

function sponsorDrafts(config: {
  sponsor?: BroadcastSponsorDraft
  sponsors?: BroadcastSponsorDraft[]
}): BroadcastSponsorDraft[] {
  if (config.sponsors) {
    return config.sponsors
  }
  return config.sponsor ? [config.sponsor] : []
}

function compactSponsors(drafts: BroadcastSponsorDraft[]): BroadcastSponsorConfig[] | undefined {
  const next: BroadcastSponsorConfig[] = []
  for (const draft of drafts) {
    if (next.length >= MAX_SPONSORS) {
      break
    }
    const sponsor = compactSponsor(draft)
    if (sponsor) {
      next.push(sponsor)
    }
  }
  return next.length > 0 ? next : undefined
}

function resolveOneSponsor(
  sponsor: BroadcastSponsorConfig
): ResolvedBroadcastSponsor | undefined {
  if (!sponsor.enabled) {
    return undefined
  }
  const name = sponsor.name
  const assetId = sponsor.assetId
  const content = resolveSponsorContent(sponsor.displayMode, {
    name,
    hasLogo: Boolean(assetId),
  })
  if (!content) {
    return undefined
  }
  return {
    position: sponsor.position,
    displayMode: sponsor.displayMode,
    ...content,
    ...(name ? { name } : {}),
    ...(assetId ? { assetId } : {}),
  }
}

function compactSponsor(
  sponsor: BroadcastSponsorDraft | undefined
): BroadcastSponsorConfig | undefined {
  if (!sponsor) {
    return undefined
  }
  const name = sponsor.name?.trim()
  const assetId = localAssetIdSchema.safeParse(sponsor.assetId).success
    ? sponsor.assetId
    : undefined
  const position = isSponsorPosition(sponsor.position) ? sponsor.position : "top-right"
  const displayMode = isSponsorDisplayMode(sponsor.displayMode)
    ? sponsor.displayMode
    : "logo-text"
  const enabled = sponsor.enabled ?? Boolean(name || assetId)
  if (
    !enabled &&
    !name &&
    !assetId &&
    position === "top-right" &&
    displayMode === "logo-text"
  ) {
    return undefined
  }
  return {
    enabled,
    position,
    displayMode,
    ...(name ? { name } : {}),
    ...(assetId ? { assetId } : {}),
  }
}

function isSponsorPosition(value: unknown): value is SponsorPosition {
  return value === "top-right" || value === "center"
}

function isSponsorDisplayMode(value: unknown): value is SponsorDisplayMode {
  return value === "logo" || value === "text" || value === "logo-text"
}

function clampWins(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.trunc(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
