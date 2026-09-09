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

export type BroadcastSponsorConfig = {
  name?: string
  assetId?: string
}

export type BroadcastConfig = {
  format: SeriesLabel
  teams: {
    left: BroadcastTeamConfig
    right: BroadcastTeamConfig
  }
  series: BroadcastSeriesScore
  event?: BroadcastEventConfig
  sponsor?: BroadcastSponsorConfig
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

const sponsorConfigSchema = z
  .object({
    name: teamNameSchema,
    assetId: localAssetIdSchema.optional(),
  })
  .strict()

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

export function compactBroadcastConfig(config: BroadcastConfig): BroadcastConfig {
  const left = compactTeam(config.teams.left)
  const right = compactTeam(config.teams.right)
  const event = compactEvent(config.event)
  const sponsor = compactSponsor(config.sponsor)
  return {
    format: config.format,
    teams: { left, right },
    series: {
      leftMapsWon: clampSeriesMapsWon(config.format, config.series.leftMapsWon),
      rightMapsWon: clampSeriesMapsWon(config.format, config.series.rightMapsWon),
    },
    ...(event ? { event } : {}),
    ...(sponsor ? { sponsor } : {}),
  }
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

export function resolveBroadcastSponsor(
  config: BroadcastConfig
): { name?: string; assetId?: string } | undefined {
  const name = config.sponsor?.name?.trim()
  const assetId = config.sponsor?.assetId
  if (!name && !assetId) {
    return undefined
  }
  return {
    ...(name ? { name } : {}),
    ...(assetId ? { assetId } : {}),
  }
}

export function referencedAssetIds(config: BroadcastConfig): readonly string[] {
  const ids: string[] = []
  const left = config.teams.left.logoAssetId
  const right = config.teams.right.logoAssetId
  const sponsor = config.sponsor?.assetId
  if (left) {
    ids.push(left)
  }
  if (right) {
    ids.push(right)
  }
  if (sponsor) {
    ids.push(sponsor)
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
    ...(value.sponsor ? { sponsor: value.sponsor } : {}),
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

function compactSponsor(
  sponsor: BroadcastSponsorConfig | undefined
): BroadcastSponsorConfig | undefined {
  const name = sponsor?.name?.trim()
  const assetId = sponsor?.assetId
  if (!name && !assetId) {
    return undefined
  }
  return {
    ...(name ? { name } : {}),
    ...(assetId ? { assetId } : {}),
  }
}

function clampWins(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.trunc(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
