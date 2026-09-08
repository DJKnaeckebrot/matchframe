import {
  defaultTheme,
  matchframeThemeSchema,
  THEME_TOKEN_LABELS,
  THEME_TOKENS,
} from "@workspace/theme"
import type { MatchframeTheme, ThemeToken } from "@workspace/theme"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3131"

export async function fetchTheme(): Promise<MatchframeTheme> {
  const response = await fetch(`${API_BASE}/api/config/theme`)
  if (!response.ok) {
    throw new Error("Could not load overlay colors")
  }
  const parsed = matchframeThemeSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned an invalid theme")
  }
  return parsed.data
}

export async function saveTheme(theme: MatchframeTheme): Promise<MatchframeTheme> {
  const response = await fetch(`${API_BASE}/api/config/theme`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(theme),
  })
  if (!response.ok) {
    throw new Error("Could not apply overlay colors")
  }
  const parsed = matchframeThemeSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned an invalid theme")
  }
  return parsed.data
}

export { defaultTheme, THEME_TOKEN_LABELS, THEME_TOKENS }
export type { MatchframeTheme, ThemeToken }
