import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createGameStateEngine } from "@workspace/game-state"
import { createGsiStateManager, sanitizeGsiCapture, debugHasFireGrenade, type GrenadePipelineDebug } from "@workspace/gsi"
import { websocket } from "hono/bun"

import { createApp } from "./app"
import { createFileAssetStore } from "./config/asset-store"
import { parseCli, cliHelp } from "./config/cli"
import { createFileOverlayStore } from "./config/overlay-store"
import { createFilePlayerStore } from "./config/player-store"
import { createFileThemeStore } from "./config/theme-store"
import {
  dashboardPublicUrl,
  gsiEndpointUri,
  listenHost,
  listenPort,
  overlayPublicUrl,
  websocketPublicUrl,
} from "./config/listen"
import { isStandaloneExecutable, resolveRuntimePaths } from "./config/paths"
import { createRealtimeHub } from "./hub"
import { PRODUCT_VERSION } from "./product"
import { openDashboard } from "./runtime/browser"
import { findRunningMatchframe, isAddrInUse } from "./runtime/instance"
import { createRuntimeLog } from "./runtime/log"
import { gameStateStore } from "./store"
import { hasEmbeddedFrontend, embeddedFrontend, mountFrontend, resolveWebRoots, shouldServeFrontend } from "./web/static"
import { defaultSetupIo, installGsiCfg } from "./setup/install"

function gsiCaptureWriter(dataDir: string): ((merged: unknown) => void) | undefined {
  if (!process.env.MATCHFRAME_GSI_CAPTURE) {
    return undefined
  }
  const path = join(dataDir, "gsi-capture", "latest.json")
  return (merged) => {
    const sanitized = sanitizeGsiCapture(merged)
    if (!sanitized) {
      return
    }
    void Bun.write(path, JSON.stringify(sanitized, null, 2))
  }
}

function grenadeDebugWriter(dataDir: string): ((debug: GrenadePipelineDebug) => void) | undefined {
  if (process.env.MATCHFRAME_DEBUG_GRENADES !== "1") {
    return undefined
  }
  const dir = join(dataDir, "gsi-capture")
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

async function main(): Promise<void> {
  const cli = parseCli(process.argv)
  if (cli.help) {
    console.log(cliHelp(PRODUCT_VERSION))
    process.exit(0)
  }

  const paths = resolveRuntimePaths({
    env: process.env,
    portable: cli.portable,
    platform: process.platform,
    cwd: process.cwd(),
    execPath: process.execPath,
    standalone: isStandaloneExecutable(),
  })
  await mkdir(paths.dataDir, { recursive: true })
  await mkdir(paths.logDir, { recursive: true })
  const log = createRuntimeLog(paths.logFile)

  const port = listenPort()
  const hostname = listenHost()
  const dashboardUrl = dashboardPublicUrl(port)
  const overlayUrl = overlayPublicUrl(port)

  if (await findRunningMatchframe(dashboardUrl)) {
    log.info("Matchframe is already running.")
    if (cli.openBrowser) {
      openDashboard(dashboardUrl)
    }
    process.exit(0)
  }

  const engine = createGameStateEngine()
  const gsi = createGsiStateManager()
  const hub = createRealtimeHub()
  const themeStore = createFileThemeStore(paths.dataDir)
  const overlayStore = createFileOverlayStore(paths.dataDir)
  const playerStore = createFilePlayerStore(paths.dataDir)
  const portraitDir = join(paths.dataDir, "portraits")
  const assetStore = createFileAssetStore(join(paths.dataDir, "assets"))
  const onGsiCapture = gsiCaptureWriter(paths.dataDir)
  const onGrenadeDebug = grenadeDebugWriter(paths.dataDir)

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

  const standalone = isStandaloneExecutable()
  if (shouldServeFrontend(process.env, standalone)) {
    const web = hasEmbeddedFrontend()
      ? embeddedFrontend()
      : resolveWebRoots(import.meta.dir, process.cwd())
    if (web) {
      mountFrontend(app, web)
      if ("dashboardDir" in web) {
        log.info(`Dashboard files: ${web.dashboardDir}`)
        log.info(`Overlay files: ${web.overlayDir}`)
      } else {
        log.info(`Dashboard files: embedded (${String(Object.keys(web.dashboard).length)} files)`)
        log.info(`Overlay files: embedded (${String(Object.keys(web.overlay).length)} files)`)
      }
    } else {
      log.warn(`Frontend assets were not found (resource dir ${import.meta.dir}).`)
    }
  }

  let server: ReturnType<typeof Bun.serve>
  try {
    server = Bun.serve({
      port,
      hostname,
      fetch: (req, bunServer) => app.fetch(req, bunServer),
      websocket,
    })
  } catch (error) {
    if (isAddrInUse(error)) {
      log.info("Matchframe is already running.")
      if (cli.openBrowser) {
        openDashboard(dashboardUrl)
      }
      process.exit(0)
    }
    log.error(error instanceof Error ? error.message : "Failed to start Matchframe")
    process.exit(1)
  }

  log.info(`Matchframe ${PRODUCT_VERSION}`)
  log.info(`Mode: ${paths.mode}`)
  log.info(`Standalone: ${String(standalone)}`)
  log.info(`Executable: ${process.execPath}`)
  log.info(`Resource dir: ${import.meta.dir}`)
  log.info(`Data directory: ${paths.dataDir}`)
  log.info(`Log file: ${paths.logFile}`)
  log.info(`Dashboard: ${dashboardUrl}`)
  log.info(`Overlay: ${overlayUrl}`)
  log.info(`GSI endpoint: ${gsiEndpointUri(port)}`)
  log.info(`WebSocket: ${websocketPublicUrl(port)}`)

  if (cli.setupGsi) {
    try {
      const result = await installGsiCfg(defaultSetupIo(), gsiEndpointUri(port))
      if (result.ok) {
        log.info(result.restartRequired ? "GSI config installed. Restart CS2." : "GSI config is up to date.")
      } else {
        log.warn(`GSI setup: ${result.error}`)
      }
    } catch (error) {
      log.warn(error instanceof Error ? `GSI setup failed: ${error.message}` : "GSI setup failed")
    }
  }

  if (cli.openBrowser) {
    openDashboard(dashboardUrl)
  }

  function shutdown(): void {
    log.info("Shutting down")
    server.stop(true)
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

void main()
