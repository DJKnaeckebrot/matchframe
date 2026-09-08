import { z } from "zod"

export const SERIES_LABELS = ["BO1", "BO3", "BO5", "BO7"] as const

export type SeriesLabel = (typeof SERIES_LABELS)[number]

export type OverlayTeamSlot = "left" | "right"

export type OverlayConfig = {
  series: SeriesLabel
  leftName?: string
  rightName?: string
}

const teamNameSchema = z.string().trim().max(32, "Team name is too long").optional()

export const overlayConfigSchema: z.ZodType<OverlayConfig> = z.object({
  series: z.enum(SERIES_LABELS),
  leftName: teamNameSchema,
  rightName: teamNameSchema,
})

export const defaultOverlayConfig: OverlayConfig = { series: "BO1" }

export function compactOverlayConfig(overlay: OverlayConfig): OverlayConfig {
  const leftName = overlay.leftName?.trim()
  const rightName = overlay.rightName?.trim()
  return {
    series: overlay.series,
    ...(leftName ? { leftName } : {}),
    ...(rightName ? { rightName } : {}),
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
