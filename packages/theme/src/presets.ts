import { defaultTheme } from "./default"
import type { MatchframeTheme } from "./types"

export type ThemePreset = {
  id: string
  label: string
  description: string
  theme: MatchframeTheme
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "nightwatch",
    label: "Nightwatch",
    description: "Gunmetal and brass.",
    theme: defaultTheme,
  },
  {
    id: "carbon",
    label: "Carbon",
    description: "High contrast for bright arenas.",
    theme: {
      background: "#070809",
      surface: "#101214",
      surfaceElevated: "#1A1D21",
      text: "#F2F4F6",
      textMuted: "#8E959E",
      accent: "#A8B2BC",
      ct: "#4A90B8",
      terrorist: "#C56A35",
      success: "#5FA86A",
      danger: "#C44A44",
    },
  },
  {
    id: "dust",
    label: "Dust",
    description: "Warm charcoal, ochre accent.",
    theme: {
      background: "#100E0C",
      surface: "#181410",
      surfaceElevated: "#221C16",
      text: "#EDE6DC",
      textMuted: "#9A8F82",
      accent: "#C9A05A",
      ct: "#6B8FA8",
      terrorist: "#B24E2E",
      success: "#7A9A5E",
      danger: "#B04840",
    },
  },
]
