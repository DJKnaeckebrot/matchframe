import { z } from "zod"

import type { MatchframeTheme, ThemeToken } from "./types"

// Hex plus rgb/hsl. Named colors and url() stay out so dashboard values stay paint-safe.
const cssColorPattern =
  /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+%?)?\s*\)|hsla?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+%?)?\s*\))$/

export const cssColorSchema = z
  .string()
  .trim()
  .min(1, "Color is required")
  .regex(cssColorPattern, "Must be a hex, rgb, or hsl color")

export const matchframeThemeSchema: z.ZodType<MatchframeTheme> = z.object({
  background: cssColorSchema,
  surface: cssColorSchema,
  surfaceElevated: cssColorSchema,
  text: cssColorSchema,
  textMuted: cssColorSchema,
  accent: cssColorSchema,
  ct: cssColorSchema,
  terrorist: cssColorSchema,
  success: cssColorSchema,
  danger: cssColorSchema,
})

export const THEME_TOKENS: readonly ThemeToken[] = [
  "background",
  "surface",
  "surfaceElevated",
  "text",
  "textMuted",
  "accent",
  "ct",
  "terrorist",
  "success",
  "danger",
]

export const THEME_TOKEN_LABELS: Record<ThemeToken, string> = {
  background: "Background",
  surface: "Surface",
  surfaceElevated: "Elevated surface",
  text: "Text",
  textMuted: "Muted text",
  accent: "Accent",
  ct: "CT",
  terrorist: "Terrorist",
  success: "Success",
  danger: "Danger",
}
