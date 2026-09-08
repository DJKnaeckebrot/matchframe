import { join } from "node:path"
import { createGameStateEngine } from "@workspace/game-state"
import { createGsiStateManager, sanitizeGsiCapture } from "@workspace/gsi"
import { websocket } from "hono/bun"

import { createApp } from "./app"
import { createFilePlayerStore } from "./config/player-store"
import { createFileThemeStore } from "./config/theme-store"
import { createRealtimeHub } from "./hub"
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

function dataDir(): string {
  return process.env.MATCHFRAME_DATA_DIR ?? join(process.cwd(), "data")
}

function gsiCaptureWriter(): ((merged: unknown) => void) | undefined {
  if (!process.env.MATCHFRAME_GSI_CAPTURE) {
    return undefined
  }
  const path = join(dataDir(), "gsi-capture", "latest.json")
  return (merged) => {
    const sanitized = sanitizeGsiCapture(merged)
    if (!sanitized) {
      return
    }
    void Bun.write(path, JSON.stringify(sanitized, null, 2))
  }
}

const engine = createGameStateEngine()
const gsi = createGsiStateManager()
const hub = createRealtimeHub()
const themeStore = createFileThemeStore(dataDir())
const playerStore = createFilePlayerStore(dataDir())
const onGsiCapture = gsiCaptureWriter()

const app = createApp({
  engine,
  gsi,
  getState: () => gameStateStore.get(),
  setState: (state) => gameStateStore.set(state),
  themeStore,
  playerStore,
  hub,
  ...(onGsiCapture ? { onGsiCapture } : {}),
})

const port = listenPort()

Bun.serve({
  port,
  fetch: (req, server) => app.fetch(req, server),
  websocket,
})

console.log(`Broadcast server running at http://localhost:${port}`)
console.log(`GSI endpoint: http://localhost:${port}/api/gsi`)
console.log(`WebSocket: ws://localhost:${port}/ws`)

