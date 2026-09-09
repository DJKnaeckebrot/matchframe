import type { GameState, GameStateEngine } from "@workspace/game-state"
import {
  normalizeGsiPayload,
  parseGsiPayload,
  type GsiStateManager,
} from "@workspace/gsi"
import {
  compactBroadcastConfig,
  MAX_SPONSORS,
  overlaySeriesWins,
  overlaySeriesWinsChanged,
  parseBroadcastConfig,
  playerPresentationSchema,
  steamIdSchema,
  type BroadcastConfig,
  type BroadcastTeamSlot,
} from "@workspace/presentation"
import { matchframeThemeSchema } from "@workspace/theme"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { upgradeWebSocket } from "hono/bun"

import {
  isSafeAssetId,
  MAX_ASSET_BYTES,
  newSponsorId,
  newTeamLogoId,
  type AssetStore,
} from "./config/asset-store"
import type { OverlayStore } from "./config/overlay-store"
import type { PlayerStore } from "./config/player-store"
import type { ThemeStore } from "./config/theme-store"
import { isSafePortraitId, readPortraitFile } from "./config/portrait-files"
import type { RealtimeHub } from "./hub"

export type ServerAppDeps = {
  engine: GameStateEngine
  gsi: GsiStateManager
  getState: () => GameState | null
  setState: (state: GameState) => void
  themeStore: ThemeStore
  overlayStore: OverlayStore
  playerStore: PlayerStore
  portraitDir: string
  assetStore: AssetStore
  hub: RealtimeHub
  onGsiCapture?: (merged: unknown) => void
}

export function createApp(deps: ServerAppDeps): Hono {
  const app = new Hono()
  seedStoredSeriesWins(deps)

  app.use(
    "/api/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
  )

  app.get("/health", (c) => c.json({ status: "ok" }))

  app.post("/api/gsi", async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON", details: [] }, 400)
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json(
        {
          error: "Invalid GSI payload",
          details: [{ path: "", message: "Expected an object" }],
        },
        400
      )
    }

    try {
      deps.gsi.update(body)
    } catch {
      return c.json({ error: "Invalid GSI payload", details: [] }, 400)
    }

    deps.onGsiCapture?.(deps.gsi.getState())

    const parsed = parseGsiPayload(deps.gsi.getState())
    if (!parsed.success) {
      return c.json({ error: parsed.error, details: parsed.details }, 400)
    }

    const { state, events } = deps.engine.apply(normalizeGsiPayload(parsed.data))
    deps.setState(state)
    deps.hub.broadcast({ type: "snapshot", data: state })
    for (const event of events) {
      deps.hub.broadcast({ type: "event", data: event })
    }
    return c.body(null, 204)
  })

  app.get("/api/state", (c) => {
    const state = deps.getState()
    if (!state) {
      return c.json({ connected: false })
    }
    return c.json({ connected: true, state })
  })

  app.get("/api/config/theme", (c) => c.json(deps.themeStore.get()))

  app.put("/api/config/theme", async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON", details: [] }, 400)
    }

    const parsed = matchframeThemeSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid theme",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      )
    }

    const theme = await deps.themeStore.set(parsed.data)
    deps.hub.broadcast({ type: "theme", data: theme })
    return c.json(theme)
  })

  app.get("/api/config/overlay", (c) => c.json(deps.overlayStore.get()))
  app.get("/api/config/broadcast", (c) => c.json(deps.overlayStore.get()))

  app.put("/api/config/overlay", (c) => putBroadcastConfig(c, deps))
  app.put("/api/config/broadcast", (c) => putBroadcastConfig(c, deps))

  app.get("/api/assets/:id", async (c) => {
    const id = c.req.param("id")
    if (!isSafeAssetId(id)) {
      return c.body(null, 404)
    }
    const file = await deps.assetStore.read(id)
    if (!file) {
      return c.body(null, 404)
    }
    return c.body(file.body, 200, {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=60",
      "Cross-Origin-Resource-Policy": "cross-origin",
    })
  })

  app.post("/api/assets/team-logo", async (c) => {
    const form = await readForm(c)
    if (!form) {
      return invalidUpload(c, "Expected multipart form data")
    }
    const slot = parseTeamSlot(formString(form, "slot"))
    if (!slot) {
      return c.json(
        {
          error: "Invalid team logo",
          details: [{ path: "slot", message: "Use left or right" }],
        },
        400
      )
    }
    return saveBroadcastImage(c, deps, form, {
      kind: "teams",
      id: newTeamLogoId(slot),
      apply: (config, id) =>
        compactBroadcastConfig({
          ...config,
          teams: {
            ...config.teams,
            [slot]: { ...config.teams[slot], logoAssetId: id },
          },
        }),
      previousId: deps.overlayStore.get().teams[slot].logoAssetId,
    })
  })

  app.post("/api/assets/sponsor", async (c) => {
    const form = await readForm(c)
    if (!form) {
      return invalidUpload(c, "Expected multipart form data")
    }
    const index = parseSponsorIndex(formString(form, "index"))
    const current = deps.overlayStore.get()
    return saveBroadcastImage(c, deps, form, {
      kind: "sponsors",
      id: newSponsorId(),
      apply: (config, id) => setSponsorAsset(config, index, id),
      previousId: (current.sponsors ?? [])[index]?.assetId,
    })
  })

  app.delete("/api/assets/:id", async (c) => {
    const id = c.req.param("id")
    if (!isSafeAssetId(id)) {
      return c.body(null, 404)
    }
    const previous = deps.overlayStore.get()
    const next = compactBroadcastConfig(stripAsset(previous, id))
    const removed = await deps.assetStore.remove(id)
    if (!removed && referencedIdsEqual(previous, next)) {
      return c.body(null, 404)
    }
    const overlay = await commitBroadcast(deps, previous, next)
    return c.json(overlay)
  })

  app.get("/api/config/players", (c) => c.json(deps.playerStore.get()))

  app.get("/api/portraits/:id", async (c) => {
    const id = c.req.param("id")
    if (!isSafePortraitId(id)) {
      return c.body(null, 404)
    }
    const file = await readPortraitFile(deps.portraitDir, id)
    if (!file) {
      return c.body(null, 404)
    }
    return c.body(file.body, 200, {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=60",
      "Cross-Origin-Resource-Policy": "cross-origin",
    })
  })

  app.put("/api/config/players/:steamId", async (c) => {
    const steamId = steamIdSchema.safeParse(c.req.param("steamId"))
    if (!steamId.success) {
      return c.json(
        {
          error: "Invalid Steam ID",
          details: steamId.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      )
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON", details: [] }, 400)
    }

    const parsed = playerPresentationSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid player presentation",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      )
    }

    const config = await deps.playerStore.upsert(steamId.data, parsed.data)
    deps.hub.broadcast({ type: "presentation", data: config })
    return c.json(config)
  })

  app.delete("/api/config/players/:steamId", async (c) => {
    const steamId = steamIdSchema.safeParse(c.req.param("steamId"))
    if (!steamId.success) {
      return c.json(
        {
          error: "Invalid Steam ID",
          details: steamId.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      )
    }

    const config = await deps.playerStore.remove(steamId.data)
    deps.hub.broadcast({ type: "presentation", data: config })
    return c.json(config)
  })

  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen(_evt, ws) {
        deps.hub.addClient(ws)
        const state = deps.getState()
        deps.hub.sendMessage(ws, {
          type: "connection",
          data: { connected: state !== null },
        })
        deps.hub.sendMessage(ws, { type: "theme", data: deps.themeStore.get() })
        deps.hub.sendMessage(ws, { type: "presentation", data: deps.playerStore.get() })
        deps.hub.sendMessage(ws, { type: "broadcast-config", data: deps.overlayStore.get() })
        if (state) {
          deps.hub.sendMessage(ws, { type: "snapshot", data: state })
        }
      },
      onClose(_evt, ws) {
        deps.hub.removeClient(ws)
      },
      onError(_evt, ws) {
        deps.hub.removeClient(ws)
      },
    }))
  )

  return app
}

function seedStoredSeriesWins(deps: ServerAppDeps): void {
  const wins = overlaySeriesWins(deps.overlayStore.get())
  if (wins.left === 0 && wins.right === 0) {
    return
  }
  const state = deps.engine.seedSeriesWins(wins.left, wins.right)
  if (state) {
    deps.setState(state)
  }
}

async function putBroadcastConfig(
  c: { req: { json: () => Promise<unknown> }; json: (body: unknown, status?: 400) => Response },
  deps: ServerAppDeps
) {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON", details: [] }, 400)
  }

  const parsed = parseBroadcastConfig(body)
  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid broadcast config",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      400
    )
  }

  const previous = deps.overlayStore.get()
  const overlay = await commitBroadcast(deps, previous, parsed.data)
  return c.json(overlay)
}

async function commitBroadcast(
  deps: ServerAppDeps,
  previous: BroadcastConfig,
  next: BroadcastConfig
): Promise<BroadcastConfig> {
  const overlay = await deps.overlayStore.set(next)
  deps.hub.broadcast({ type: "broadcast-config", data: overlay })
  if (overlaySeriesWinsChanged(previous, overlay)) {
    const wins = overlaySeriesWins(overlay)
    const state = deps.engine.seedSeriesWins(wins.left, wins.right)
    if (state) {
      deps.setState(state)
      deps.hub.broadcast({ type: "snapshot", data: state })
    }
  }
  return overlay
}

async function saveBroadcastImage(
  c: { json: (body: unknown, status?: 400) => Response },
  deps: ServerAppDeps,
  form: FormData,
  options: {
    kind: "teams" | "sponsors"
    id: string
    apply: (config: BroadcastConfig, id: string) => BroadcastConfig
    previousId?: string
  }
) {
  const bytes = await fileBytes(form.get("file"))
  if (!bytes) {
    return invalidUpload(c, "Image is required")
  }
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    return invalidUpload(c, "Image is too large")
  }

  try {
    const saved = await deps.assetStore.save(options.kind, options.id, bytes)
    const previous = deps.overlayStore.get()
    const overlay = await commitBroadcast(deps, previous, options.apply(previous, saved.id))
    if (options.previousId && options.previousId !== saved.id) {
      await deps.assetStore.remove(options.previousId)
    }
    return c.json({ id: saved.id, config: overlay })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store image"
    return invalidUpload(c, message)
  }
}

function invalidUpload(
  c: { json: (body: unknown, status?: 400) => Response },
  message: string
) {
  return c.json({ error: "Invalid upload", details: [{ path: "file", message }] }, 400)
}

async function readForm(c: { req: { formData: () => Promise<FormData> } }): Promise<FormData | null> {
  try {
    return await c.req.formData()
  } catch {
    return null
  }
}

function stripAsset(config: BroadcastConfig, id: string): BroadcastConfig {
  return {
    ...config,
    teams: {
      left:
        config.teams.left.logoAssetId === id
          ? { ...config.teams.left, logoAssetId: undefined }
          : config.teams.left,
      right:
        config.teams.right.logoAssetId === id
          ? { ...config.teams.right, logoAssetId: undefined }
          : config.teams.right,
    },
    sponsors: (config.sponsors ?? []).map((sponsor) =>
      sponsor.assetId === id ? { ...sponsor, assetId: undefined } : sponsor
    ),
  }
}

function referencedIdsEqual(a: BroadcastConfig, b: BroadcastConfig): boolean {
  return (
    a.teams.left.logoAssetId === b.teams.left.logoAssetId &&
    a.teams.right.logoAssetId === b.teams.right.logoAssetId &&
    sponsorAssetKey(a) === sponsorAssetKey(b)
  )
}

function sponsorAssetKey(config: BroadcastConfig): string {
  return (config.sponsors ?? []).map((sponsor) => sponsor.assetId ?? "").join("|")
}

function setSponsorAsset(config: BroadcastConfig, index: number, id: string): BroadcastConfig {
  const sponsors = [...(config.sponsors ?? [])]
  if (index >= 0 && index < sponsors.length) {
    sponsors[index] = { ...sponsors[index], assetId: id }
  } else if (sponsors.length < MAX_SPONSORS) {
    sponsors.push({
      enabled: true,
      position: "top-right",
      displayMode: "logo-text",
      assetId: id,
    })
  }
  return compactBroadcastConfig({ ...config, sponsors })
}

function parseSponsorIndex(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 0
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.min(MAX_SPONSORS - 1, Math.trunc(parsed))
}

function parseTeamSlot(value: string | undefined): BroadcastTeamSlot | null {
  return value === "left" || value === "right" ? value : null
}

function formString(form: FormData | null, key: string): string | undefined {
  const value = form?.get(key)
  return typeof value === "string" ? value : undefined
}

async function fileBytes(value: unknown): Promise<Uint8Array | null> {
  if (value instanceof File) {
    return new Uint8Array(await value.arrayBuffer())
  }
  if (value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer())
  }
  return null
}
