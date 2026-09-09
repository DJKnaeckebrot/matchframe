import type { GameState } from "@workspace/game-state"
import {
  overlayConfigSchema,
  playerPresentationConfigSchema,
  playerPresentationSchema,
  localAssetIdSchema,
  type BroadcastConfig,
  type OverlayConfig,
  type PlayerPresentation,
  type PlayerPresentationConfig,
} from "@workspace/presentation"
import {
  defaultTheme,
  matchframeThemeSchema,
  THEME_TOKEN_LABELS,
  THEME_TOKENS,
} from "@workspace/theme"
import type { MatchframeTheme, ThemeToken } from "@workspace/theme"

/** Empty in Vite so `/api` is same-origin and proxied. Set VITE_API_URL to call the server directly. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")

function api(path: string): string {
  return `${API_BASE}${path}`
}

export async function fetchTheme(): Promise<MatchframeTheme> {
  const response = await fetch(api("/api/config/theme"))
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
  const response = await fetch(api("/api/config/theme"), {
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

export async function fetchOverlayConfig(): Promise<BroadcastConfig> {
  const response = await fetch(api("/api/config/broadcast"))
  if (!response.ok) {
    throw new Error("Could not load overlay settings")
  }
  const parsed = overlayConfigSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned invalid overlay settings")
  }
  return parsed.data
}

export async function saveOverlayConfig(overlay: BroadcastConfig): Promise<BroadcastConfig> {
  const response = await fetch(api("/api/config/broadcast"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overlay),
  })
  if (!response.ok) {
    throw new Error("Could not apply overlay settings")
  }
  const parsed = overlayConfigSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned invalid overlay settings")
  }
  return parsed.data
}

export async function uploadTeamLogo(
  slot: "left" | "right",
  file: File
): Promise<{ id: string; config: BroadcastConfig }> {
  const body = new FormData()
  body.set("slot", slot)
  body.set("file", file)
  return postAsset("/api/assets/team-logo", body)
}

export async function uploadSponsorLogo(
  index: number,
  file: File
): Promise<{ id: string; config: BroadcastConfig }> {
  const body = new FormData()
  body.set("index", String(index))
  body.set("file", file)
  return postAsset("/api/assets/sponsor", body)
}

export async function deleteBroadcastAsset(id: string): Promise<BroadcastConfig> {
  const response = await fetch(api(`/api/assets/${encodeURIComponent(id)}`), { method: "DELETE" })
  if (!response.ok) {
    throw new Error("Could not remove image")
  }
  const parsed = overlayConfigSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned invalid overlay settings")
  }
  return parsed.data
}

export function getBroadcastAsset(id: string): string | undefined {
  if (!localAssetIdSchema.safeParse(id).success) {
    return undefined
  }
  return api(`/api/assets/${id}`)
}

async function postAsset(
  path: string,
  body: FormData
): Promise<{ id: string; config: BroadcastConfig }> {
  const response = await fetch(api(path), { method: "POST", body })
  if (!response.ok) {
    throw new Error("Could not store image")
  }
  const raw: unknown = await response.json()
  if (!isRecord(raw) || typeof raw.id !== "string") {
    throw new Error("Server returned an invalid asset")
  }
  const parsed = overlayConfigSchema.safeParse(raw.config)
  if (!parsed.success) {
    throw new Error("Server returned invalid overlay settings")
  }
  return { id: raw.id, config: parsed.data }
}

export async function fetchGameState(): Promise<GameState | null> {
  const response = await fetch(api("/api/state"))
  if (!response.ok) {
    throw new Error("Could not load match state")
  }
  const body: unknown = await response.json()
  if (!isRecord(body) || body.connected !== true || !isRecord(body.state)) {
    return null
  }
  if (!Array.isArray(body.state.players) || !Array.isArray(body.state.teams)) {
    return null
  }
  return body.state as GameState
}

export async function fetchPlayersConfig(): Promise<PlayerPresentationConfig> {
  const response = await fetch(api("/api/config/players"))
  if (!response.ok) {
    throw new Error("Could not load player presentation")
  }
  const parsed = playerPresentationConfigSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned invalid player presentation")
  }
  return parsed.data
}

export async function savePlayerPresentation(
  steamId: string,
  entry: PlayerPresentation
): Promise<PlayerPresentationConfig> {
  const body = playerPresentationSchema.parse(entry)
  const response = await fetch(api(`/api/config/players/${encodeURIComponent(steamId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error("Could not save player presentation")
  }
  const parsed = playerPresentationConfigSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned invalid player presentation")
  }
  return parsed.data
}

export async function deletePlayerPresentation(steamId: string): Promise<PlayerPresentationConfig> {
  const response = await fetch(api(`/api/config/players/${encodeURIComponent(steamId)}`), {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error("Could not clear player presentation")
  }
  const parsed = playerPresentationConfigSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Server returned invalid player presentation")
  }
  return parsed.data
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export { defaultTheme, THEME_TOKEN_LABELS, THEME_TOKENS }
export type {
  BroadcastConfig,
  MatchframeTheme,
  OverlayConfig,
  PlayerPresentation,
  PlayerPresentationConfig,
  ThemeToken,
}
