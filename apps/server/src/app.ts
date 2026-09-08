import type { GameState, GameStateEngine } from "@workspace/game-state"
import { normalizeGsiPayload, parseGsiPayload } from "@workspace/gsi"
import { matchframeThemeSchema } from "@workspace/theme"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { upgradeWebSocket } from "hono/bun"

import type { ThemeStore } from "./config/theme-store"
import type { RealtimeHub } from "./hub"

export type ServerAppDeps = {
  engine: GameStateEngine
  getState: () => GameState | null
  setState: (state: GameState) => void
  themeStore: ThemeStore
  hub: RealtimeHub
}

export function createApp(deps: ServerAppDeps): Hono {
  const app = new Hono()

  app.use(
    "/api/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "PUT", "POST", "OPTIONS"],
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

    const parsed = parseGsiPayload(body)
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
