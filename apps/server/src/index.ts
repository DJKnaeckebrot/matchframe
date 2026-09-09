import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createGameStateEngine } from "@workspace/game-state"
import { createGsiStateManager, sanitizeGsiCapture, debugHasFireGrenade, type GrenadePipelineDebug } from "@workspace/gsi"
import { websocket } from "hono/bun"

import { createApp } from "./app"
import { createFileAssetStore } from "./config/asset-store"
import { gsiEndpointUri, listenPort } from "./config/listen"
import { createFileOverlayStore } from "./config/overlay-store"
import { createFilePlayerStore } from "./config/player-store"
import { createFileThemeStore } from "./config/theme-store"
import { createRealtimeHub } from "./hub"
import { gameStateStore } from "./store"

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
const overlayStore = createFileOverlayStore(dataDir())
const playerStore = createFilePlayerStore(dataDir())
const portraitDir = join(dataDir(), "portraits")
const assetStore = createFileAssetStore(join(dataDir(), "assets"))

function grenadeDebugWriter(): ((debug: GrenadePipelineDebug) => void) | undefined {
  if (process.env.MATCHFRAME_DEBUG_GRENADES !== "1") {
    return undefined
  }
  const dir = join(dataDir(), "gsi-capture")
  const jsonl = join(dir, "grenades.jsonl")
  const latest = join(dir, "grenades-latest.json")
  void mkdir(dir, { recursive: true })
  return (debug) => {
    if (!debugHasFireGrenade(debug)) {
      return
    }
    console.log(
      `[grenades] ${debug.incomingGrenadeBlock} in=${debug.incoming.length} all=${debug.incomingAllgrenades.length} merged=${debug.merged.length} mergedAll=${debug.mergedAllgrenades.length} norm=${debug.normalized.length}`
    )
    for (const grenade of [...debug.incoming, ...debug.incomingAllgrenades, ...debug.merged, ...debug.mergedAllgrenades]) {
      console.log(
        `  ${grenade.id} type=${String(grenade.type)} pos=${String(grenade.position)} flames=${grenade.flames.jsType}${grenade.flames.keys ? ` keys=${grenade.flames.keys.join(",")}` : ""} kinds=${grenade.flames.valueKinds?.join(",") ?? "-"}`
      )
    }
    const line = JSON.stringify({ t: Date.now(), ...debug })
    void Bun.write(latest, JSON.stringify(debug, null, 2))
    void appendFile(jsonl, `${line}\n`)
  }
}

const onGsiCapture = gsiCaptureWriter()
const onGrenadeDebug = grenadeDebugWriter()

const app = createApp({
  engine,
  gsi,
  getState: () => gameStateStore.get(),
  setState: (state) => gameStateStore.set(state),
  themeStore,
  overlayStore,
  playerStore,
  portraitDir,
  assetStore,
  hub,
  ...(onGsiCapture ? { onGsiCapture } : {}),
  ...(onGrenadeDebug ? { onGrenadeDebug } : {}),
})

const port = listenPort()

Bun.serve({
  port,
  fetch: (req, server) => app.fetch(req, server),
  websocket,
})

console.log(`Broadcast server running at http://localhost:${port}`)
console.log(`GSI endpoint: ${gsiEndpointUri(port)}`)
console.log(`WebSocket: ws://localhost:${port}/ws`)

