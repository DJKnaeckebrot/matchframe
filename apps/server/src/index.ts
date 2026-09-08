import { join } from "node:path"
import { createGameStateEngine } from "@workspace/game-state"
import { websocket } from "hono/bun"

import { createApp } from "./app"
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

const engine = createGameStateEngine()
const hub = createRealtimeHub()
const themeStore = createFileThemeStore(dataDir())

const app = createApp({
  engine,
  getState: () => gameStateStore.get(),
  setState: (state) => gameStateStore.set(state),
  themeStore,
  hub,
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
