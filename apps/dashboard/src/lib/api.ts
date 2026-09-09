import type { BroadcastStatus, GameState } from "@workspace/game-state"
import { parseBroadcastStatus } from "@workspace/game-state"
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

import { parseSetupStatus, type SetupStatus } from "@/lib/setup.ts"
import { resolveOverlayPublicUrl } from "@/lib/overlay-url.ts"

/** Empty in Vite so `/api` is same-origin and proxied. Set VITE_API_URL to call the server directly. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")

/** OBS browser source. Dev uses Vite :5174; production uses same-origin `/overlay`. */
export function overlayPublicUrl(): string {
  return resolveOverlayPublicUrl({
    explicit: import.meta.env.VITE_OVERLAY_URL,
    production: import.meta.env.PROD,
    overlayPort: import.meta.env.VITE_OVERLAY_PORT,
    location: typeof window === "undefined" ? undefined : window.location,
  })
}

function api(path: string): string {
  return `${API_BASE}${path}`
}

export function setupCfgDownloadUrl(): string {
  return api("/api/setup/gsi.cfg")
}

export async function fetchBroadcastStatus(): Promise<BroadcastStatus> {
  const response = await fetch(api("/api/status"))
  if (!response.ok) {
    throw new Error("Could not load broadcast status")
  }
  const parsed = parseBroadcastStatus(await response.json())
  if (!parsed) {
    throw new Error("Server returned invalid broadcast status")
  }
  return parsed
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const response = await fetch(api("/api/setup"))
  if (!response.ok) {
    throw new Error("Could not load setup status")
  }
  const parsed = parseSetupStatus(await response.json())
  if (!parsed) {
    throw new Error("Server returned invalid setup status")
  }
  return parsed
}

export async function installGsiConfig(): Promise<{ setup: SetupStatus; restartRequired: boolean }> {
  const response = await fetch(api("/api/setup/gsi/install"), { method: "POST" })
  const raw: unknown = await response.json().catch(() => null)
  const setup = isRecord(raw) ? parseSetupStatus(raw.setup) : null
  if (response.status === 409 && setup) {
    throw new InstallGsiError(setup)
  }
  if (!response.ok || !setup || !isRecord(raw)) {
    throw new Error("Could not install the GSI configuration")
  }
  return { setup, restartRequired: raw.restartRequired === true }
}

export class InstallGsiError extends Error {
  setup: SetupStatus
  constructor(setup: SetupStatus) {
    super("Could not install the GSI configuration")
    this.setup = setup
  }
}

export async function openGsiFolder(): Promise<void> {
  const response = await fetch(api("/api/setup/gsi/open-folder"), { method: "POST" })
  if (!response.ok) {
    throw new Error("Could not open the CS2 cfg folder")
  }
}

export async function resetMatchState(): Promise<void> {
  const response = await fetch(api("/api/match/reset"), { method: "POST" })
  if (!response.ok) {
    throw new Error("Could not reset match state")
  }
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
export type { SetupStatus } from "@/lib/setup.ts"
export type {
  BroadcastConfig,
  BroadcastStatus,
  MatchframeTheme,
  OverlayConfig,
  PlayerPresentation,
  PlayerPresentationConfig,
  ThemeToken,
}
