import type { MatchframeTheme, ThemeToken } from "./types"

export const THEME_CSS_VARS: Record<ThemeToken, string> = {
  background: "--mf-background",
  surface: "--mf-surface",
  surfaceElevated: "--mf-surface-elevated",
  text: "--mf-text",
  textMuted: "--mf-text-muted",
  accent: "--mf-accent",
  ct: "--mf-ct",
  terrorist: "--mf-t",
  success: "--mf-success",
  danger: "--mf-danger",
}

export function themeToCssVars(theme: MatchframeTheme): Record<string, string> {
  return {
    [THEME_CSS_VARS.background]: theme.background,
    [THEME_CSS_VARS.surface]: theme.surface,
    [THEME_CSS_VARS.surfaceElevated]: theme.surfaceElevated,
    [THEME_CSS_VARS.text]: theme.text,
    [THEME_CSS_VARS.textMuted]: theme.textMuted,
    [THEME_CSS_VARS.accent]: theme.accent,
    [THEME_CSS_VARS.ct]: theme.ct,
    [THEME_CSS_VARS.terrorist]: theme.terrorist,
    [THEME_CSS_VARS.success]: theme.success,
    [THEME_CSS_VARS.danger]: theme.danger,
  }
}
