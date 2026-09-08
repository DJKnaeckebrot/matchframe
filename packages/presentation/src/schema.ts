import { z } from "zod"

import { isOperatorId } from "./operators"
import type { PlayerPresentation, PlayerPresentationConfig, PortraitRef } from "./types"

export const steamIdSchema = z
  .string()
  .trim()
  .min(1, "Steam ID is required")
  .max(32, "Steam ID is too long")
  .regex(/^[0-9A-Za-z_-]+$/, "Steam ID must be alphanumeric")

/** Local asset key. Paths and remote URLs stay out of broadcast config. */
export const localAssetIdSchema = z
  .string()
  .trim()
  .min(1, "Asset id is required")
  .max(64, "Asset id is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Must be a local asset id")

export const operatorIdSchema = z
  .string()
  .trim()
  .refine(isOperatorId, { message: "Unknown operator" })

export const portraitRefSchema: z.ZodType<PortraitRef> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("operator"),
    value: operatorIdSchema,
  }),
  z.object({
    type: z.literal("custom"),
    value: localAssetIdSchema,
  }),
])

export const playerPresentationSchema: z.ZodType<PlayerPresentation> = z
  .object({
    displayName: z.string().trim().max(32, "Display name is too long").optional(),
    portrait: portraitRefSchema.optional(),
  })
  .strict()

export const playerPresentationConfigSchema: z.ZodType<PlayerPresentationConfig> = z.record(
  steamIdSchema,
  playerPresentationSchema
)

export const emptyPlayerPresentationConfig: PlayerPresentationConfig = {}

export function isEmptyPresentation(entry: PlayerPresentation): boolean {
  return !entry.displayName && !entry.portrait
}
