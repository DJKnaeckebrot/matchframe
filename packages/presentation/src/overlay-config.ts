import { z } from "zod"

export const SERIES_LABELS = ["BO1", "BO3", "BO5", "BO7"] as const

export type SeriesLabel = (typeof SERIES_LABELS)[number]

export type OverlayTeamSlot = "left" | "right"

export type OverlaySeriesWins = {
  left: number
  right: number
}

export type OverlayConfig = {
  series: SeriesLabel
  leftName?: string
  rightName?: string
  leftWins?: number
  rightWins?: number
}

const teamNameSchema = z.string().trim().max(32, "Team name is too long").optional()
const seriesWinsSchema = z.number().int().min(0).max(4)

export const overlayConfigSchema: z.ZodType<OverlayConfig> = z.object({
  series: z.enum(SERIES_LABELS),
  leftName: teamNameSchema,
  rightName: teamNameSchema,
  leftWins: seriesWinsSchema.optional(),
  rightWins: seriesWinsSchema.optional(),
})

export const defaultOverlayConfig: OverlayConfig = { series: "BO1" }

export function seriesWinsNeeded(series: SeriesLabel): number {
  return series === "BO1" ? 0 : (Number(series.slice(2)) + 1) / 2
}

export function overlaySeriesWins(overlay: OverlayConfig): OverlaySeriesWins | undefined {
  if (overlay.leftWins === undefined && overlay.rightWins === undefined) {
    return undefined
  }
  return { left: overlay.leftWins ?? 0, right: overlay.rightWins ?? 0 }
}

export function overlaySeriesWinsChanged(a: OverlayConfig, b: OverlayConfig): boolean {
  const from = overlaySeriesWins(a)
  const to = overlaySeriesWins(b)
  return from?.left !== to?.left || from?.right !== to?.right
}

export function compactOverlayConfig(overlay: OverlayConfig): OverlayConfig {
  const leftName = overlay.leftName?.trim()
  const rightName = overlay.rightName?.trim()
  const max = seriesWinsNeeded(overlay.series)
  const wins = overlaySeriesWins(overlay)
  return {
    series: overlay.series,
    ...(leftName ? { leftName } : {}),
    ...(rightName ? { rightName } : {}),
    ...(max > 0 && wins
      ? { leftWins: clampWins(wins.left, max), rightWins: clampWins(wins.right, max) }
      : {}),
  }
}

export function overlayTeamName(
  overlay: Pick<OverlayConfig, "leftName" | "rightName">,
  slot: OverlayTeamSlot,
  fallback: string
): string {
  const override = (slot === "left" ? overlay.leftName : overlay.rightName)?.trim()
  return override || fallback
}

function clampWins(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.trunc(value)))
}
