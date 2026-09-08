import { Hono } from "hono"
import { normalizeGsiPayload, parseGsiPayload } from "@workspace/gsi"

import { gameStateStore } from "./store"

const DEFAULT_PORT = 3131

function listenPort(): number {
  const raw = process.env.PORT
  if (!raw) {
    return DEFAULT_PORT
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT
}

const app = new Hono()

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

  gameStateStore.set(normalizeGsiPayload(parsed.data))
  return c.body(null, 204)
})

app.get("/api/state", (c) => {
  const state = gameStateStore.get()
  if (!state) {
    return c.json({ connected: false })
  }
  return c.json({ connected: true, state })
})

const port = listenPort()

Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`Broadcast server running at http://localhost:${port}`)
console.log(`GSI endpoint: http://localhost:${port}/api/gsi`)
