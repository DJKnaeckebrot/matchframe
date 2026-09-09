import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import { createGameStateEngine, parseBroadcastStatus, parseServerMessage } from "@workspace/game-state"
import type { GameState } from "@workspace/game-state"
import { createGsiStateManager, loadGsiFixture } from "@workspace/gsi"
import { defaultBroadcastConfig, emptyPlayerPresentationConfig } from "@workspace/presentation"
import { defaultTheme } from "@workspace/theme"
import { websocket } from "hono/bun"

import { createApp } from "./app"
import { createFileAssetStore } from "./config/asset-store"
import { createFileOverlayStore } from "./config/overlay-store"
import { createFilePlayerStore } from "./config/player-store"
import { createFileThemeStore } from "./config/theme-store"
import { createRealtimeHub } from "./hub"
import type { SetupIo } from "./setup/install"
import { pathApiFor } from "./setup/steam"
import { parseSetupStatus } from "./setup/types"

const liveFixturePath = new URL("../../../packages/gsi/fixtures/inferno-live.json", import.meta.url)

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "matchframe-theme-"))
}

function testApp(dir: string, setupIo?: SetupIo) {
  const store: { current: GameState | null } = { current: null }
  const hub = createRealtimeHub()
  const engine = createGameStateEngine()
  const gsi = createGsiStateManager()
  const themeStore = createFileThemeStore(dir)
  const overlayStore = createFileOverlayStore(dir)
  const playerStore = createFilePlayerStore(dir)
  const app = createApp({
    engine,
    gsi,
    getState: () => store.current,
    setState: (state) => {
      store.current = state
    },
    themeStore,
    overlayStore,
    playerStore,
    portraitDir: join(dir, "portraits"),
    assetStore: createFileAssetStore(join(dir, "assets")),
    hub,
    ...(setupIo ? { setupIo } : {}),
  })
  return { app, hub, themeStore, overlayStore, playerStore, engine, gsi, store }
}

const servers: Array<{ stop: () => void }> = []

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop()
  }
})

describe("theme config", () => {
  test("GET returns the default theme when no config file exists", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/config/theme")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(defaultTheme)
  })

  test("PUT replaces a valid theme", async () => {
    const dir = await tempDir()
    const { app } = testApp(dir)
    const next = { ...defaultTheme, accent: "#FFAA00" }

    const response = await app.request("/api/config/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(next)
    expect(JSON.parse(await readFile(join(dir, "theme.json"), "utf8"))).toEqual(next)

    const { app: restarted } = testApp(dir)
    const loaded = await restarted.request("/api/config/theme")
    expect(await loaded.json()).toEqual(next)
  })

  test("PUT rejects invalid theme values", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/config/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...defaultTheme, accent: "nope" }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string; details: unknown[] }
    expect(body.error).toBe("Invalid theme")
    expect(body.details.length).toBeGreaterThan(0)
  })

  test("malformed config file falls back to defaults", async () => {
    const dir = await tempDir()
    await Bun.write(join(dir, "theme.json"), "{not json")
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    try {
      const { app } = testApp(dir)
      const response = await app.request("/api/config/theme")
      expect(await response.json()).toEqual(defaultTheme)
    } finally {
      console.warn = original
    }
    expect(warnings.some((line) => line.includes("malformed theme config"))).toBe(true)
  })
})

describe("overlay config", () => {
  test("GET returns BO1 when no config file exists", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/config/broadcast")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(defaultBroadcastConfig)
  })

  test("PUT replaces a valid series and survives restart", async () => {
    const dir = await tempDir()
    const { app } = testApp(dir)
    const next = {
      format: "BO3" as const,
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    }

    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "BO3" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(next)
    expect(JSON.parse(await readFile(join(dir, "overlay.json"), "utf8"))).toEqual(next)

    const { app: restarted } = testApp(dir)
    const loaded = await restarted.request("/api/config/broadcast")
    expect(await loaded.json()).toEqual(next)
  })

  test("PUT stores team display names", async () => {
    const dir = await tempDir()
    const { app } = testApp(dir)
    const next = {
      format: "BO3" as const,
      teams: { left: { name: "FaZe" }, right: { name: "NaVi" } },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    }

    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO3",
        teams: { left: { name: "  FaZe  " }, right: { name: "NaVi" } },
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(next)
    expect(JSON.parse(await readFile(join(dir, "overlay.json"), "utf8"))).toEqual(next)
  })

  test("PUT persists sponsor presentation and reloads it", async () => {
    const dir = await tempDir()
    const { app } = testApp(dir)
    const next = {
      format: "BO1" as const,
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsors: [
        {
          enabled: true,
          name: "Local LAN",
          position: "center" as const,
          displayMode: "logo" as const,
        },
      ],
    }

    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO1",
        sponsor: {
          enabled: true,
          name: " Local LAN ",
          position: "center",
          displayMode: "logo",
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(next)
    expect(JSON.parse(await readFile(join(dir, "overlay.json"), "utf8"))).toEqual(next)

    const { app: restarted } = testApp(dir)
    expect(await (await restarted.request("/api/config/broadcast")).json()).toEqual(next)
  })

  test("PUT rejects unknown series lengths", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "BO2" }),
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string; details: unknown[] }
    expect(body.error).toBe("Invalid broadcast config")
    expect(body.details.length).toBeGreaterThan(0)
  })

  test("legacy overlay PUT still migrates", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/config/overlay", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series: "BO3", leftName: "FaZe", leftWins: 1, rightWins: 0 }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      format: "BO3",
      teams: { left: { name: "FaZe" }, right: {} },
      series: { leftMapsWon: 1, rightMapsWon: 0 },
    })
  })

  test("malformed overlay.json falls back to defaults", async () => {
    const dir = await tempDir()
    await Bun.write(join(dir, "overlay.json"), "{not json")
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    try {
      const { app } = testApp(dir)
      const response = await app.request("/api/config/broadcast")
      expect(await response.json()).toEqual(defaultBroadcastConfig)
    } finally {
      console.warn = original
    }
    expect(warnings.some((line) => line.includes("malformed overlay config"))).toBe(true)
  })

  test("PUT map wins seeds the live series score", async () => {
    const { app } = testApp(await tempDir())
    const payload = await Bun.file(liveFixturePath).json()
    const posted = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(posted.status).toBe(204)

    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO3",
        series: { leftMapsWon: 1, rightMapsWon: 0 },
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      format: "BO3",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 1, rightMapsWon: 0 },
    })

    const state = (await (await app.request("/api/state")).json()) as {
      connected: boolean
      state: { teams: Array<{ seriesWins: number }> }
    }
    expect(state.state.teams.map((team) => team.seriesWins)).toEqual([1, 0])

    const namesOnly = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO3",
        teams: { left: { name: "FaZe" }, right: {} },
        series: { leftMapsWon: 1, rightMapsWon: 0 },
      }),
    })
    expect(namesOnly.status).toBe(200)
    const unchanged = (await (await app.request("/api/state")).json()) as {
      state: { teams: Array<{ seriesWins: number }> }
    }
    expect(unchanged.state.teams.map((team) => team.seriesWins)).toEqual([1, 0])

    const reset = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO3",
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      }),
    })
    expect(reset.status).toBe(200)
    const cleared = (await (await app.request("/api/state")).json()) as {
      state: { teams: Array<{ seriesWins: number }> }
    }
    expect(cleared.state.teams.map((team) => team.seriesWins)).toEqual([0, 0])
  })

  test("stored map wins seed the first GSI snapshot after restart", async () => {
    const dir = await tempDir()
    const { app } = testApp(dir)
    const saved = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO3",
        series: { leftMapsWon: 1, rightMapsWon: 0 },
      }),
    })
    expect(saved.status).toBe(200)

    const { app: restarted } = testApp(dir)
    const payload = await Bun.file(liveFixturePath).json()
    const posted = await restarted.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(posted.status).toBe(204)
    const state = (await (await restarted.request("/api/state")).json()) as {
      state: { teams: Array<{ seriesWins: number }> }
    }
    expect(state.state.teams.map((team) => team.seriesWins)).toEqual([1, 0])
  })
})

describe("realtime theme", () => {
  test("a new client receives connection, theme, then presentation", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const messages = await collectWsMessages(`ws://127.0.0.1:${server.port}/ws`, 4)
    expect(messages.map((message) => message.type)).toEqual([
      "connection",
      "theme",
      "presentation",
      "broadcast-config",
    ])
    expect(messages[1]).toEqual({ type: "theme", data: defaultTheme })
    expect(messages[2]).toEqual({ type: "presentation", data: emptyPlayerPresentationConfig })
    expect(messages[3]).toEqual({ type: "broadcast-config", data: defaultBroadcastConfig })
  })

  test("theme update is broadcast to connected clients", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await opened
    await waitFor(() => received.length >= 3)

    const next = { ...defaultTheme, accent: "#112233" }
    const response = await app.request("/api/config/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
    expect(response.status).toBe(200)
    await waitFor(() => received.some((message) => isTheme(message) && message.data.accent === "#112233"))
    ws.close()
  })

  test("broadcast-config sponsor updates are pushed to connected clients", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await opened
    await waitFor(() => received.length >= 4)

    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO1",
        sponsor: { enabled: true, name: "Local LAN", position: "center", displayMode: "logo-text" },
      }),
    })
    expect(response.status).toBe(200)
    await waitFor(() =>
      received.some(
        (message) =>
          isBroadcastConfig(message) &&
          message.data.sponsors?.[0]?.enabled === true &&
          message.data.sponsors?.[0]?.name === "Local LAN" &&
          message.data.sponsors?.[0]?.position === "center"
      )
    )
    ws.close()
  })

  test("GSI fixture still produces a snapshot after the theme handshake", async () => {
    const { app } = testApp(await tempDir())
    const payload = await Bun.file(liveFixturePath).json()
    const posted = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(posted.status).toBe(204)

    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const messages = await collectWsMessages(`ws://127.0.0.1:${server.port}/ws`, 5)
    expect(messages.map((message) => message.type)).toEqual([
      "connection",
      "theme",
      "presentation",
      "broadcast-config",
      "snapshot",
    ])
  })

  test("round over broadcasts a transient interstitial to live and reconnecting clients", async () => {
    const { app } = testApp(await tempDir())
    const freeze = await loadGsiFixture("freeze")
    const over = await loadGsiFixture("round-ct-win")
    const postedFreeze = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freeze),
    })
    expect(postedFreeze.status).toBe(204)

    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await opened
    await waitFor(() => received.length >= 5)

    const postedOver = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(over),
    })
    expect(postedOver.status).toBe(204)
    await waitFor(() => received.some(isActiveInterstitial))
    ws.close()

    const reconnect = await collectWsMessages(`ws://127.0.0.1:${server.port}/ws`, 6)
    expect(reconnect.some(isActiveInterstitial)).toBe(true)
  })

  test("partial GSI posts merge instead of replacing roster", async () => {
    const { app } = testApp(await tempDir())
    const payload = await Bun.file(liveFixturePath).json()
    const full = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    expect(full.status).toBe(204)

    const omitted = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: { timestamp: 1710000001 } }),
    })
    expect(omitted.status).toBe(204)

    const afterOmit = (await (await app.request("/api/state")).json()) as {
      state: {
        timestamp: number
        map: { name: string }
        players: Array<{
          steamId: string
          health: number
          equipment: { primary?: { id: string } }
        }>
      }
    }
    expect(afterOmit.state.timestamp).toBe(1710000001)
    expect(afterOmit.state.map.name).toBe("de_inferno")
    expect(afterOmit.state.players).toHaveLength(6)

    const novaId = "76561198000000001"
    const healthOnly = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allplayers: Object.fromEntries(
          afterOmit.state.players.map((player) => [
            player.steamId,
            player.steamId === novaId ? { state: { health: 41 } } : {},
          ])
        ),
      }),
    })
    expect(healthOnly.status).toBe(204)

    const afterHealth = (await (await app.request("/api/state")).json()) as {
      state: {
        players: Array<{
          steamId: string
          health: number
          equipment: { primary?: { id: string } }
        }>
      }
    }
    const nova = afterHealth.state.players.find((player) => player.steamId === novaId)
    expect(afterHealth.state.players).toHaveLength(6)
    expect(nova?.health).toBe(41)
    expect(nova?.equipment.primary?.id).toBe("m4a4")
  })

  test("rejects non-object GSI bodies", async () => {
    const { app } = testApp(await tempDir())
    for (const body of ["null", "[]", "42"]) {
      const response = await app.request("/api/gsi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
      expect(response.status).toBe(400)
    }
  })
})

describe("player presentation config", () => {
  const steamId = "76561198000000001"
  const entry = {
    displayName: "Nova",
    portrait: { type: "operator" as const, value: "ctm_sas_variantf" },
  }

  test("GET returns an empty map when no config file exists", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/config/players")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({})
  })

  test("PUT upserts one player and reloads from disk", async () => {
    const dir = await tempDir()
    const { app } = testApp(dir)
    const response = await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ [steamId]: entry })
    expect(JSON.parse(await readFile(join(dir, "players.json"), "utf8"))).toEqual({
      [steamId]: entry,
    })

    const { app: restarted } = testApp(dir)
    const loaded = await restarted.request("/api/config/players")
    expect(await loaded.json()).toEqual({ [steamId]: entry })
  })

  test("PUT rejects unknown operators and remote portrait URLs", async () => {
    const { app } = testApp(await tempDir())
    const unknown = await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portrait: { type: "operator", value: "ct_sas" } }),
    })
    expect(unknown.status).toBe(400)

    const remote = await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portrait: { type: "custom", value: "https://cdn.example/nova.png" },
      }),
    })
    expect(remote.status).toBe(400)
  })

  test("DELETE clears a player and empty PUT is the same as delete", async () => {
    const { app } = testApp(await tempDir())
    await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
    const cleared = await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(await cleared.json()).toEqual({})

    await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
    const deleted = await app.request(`/api/config/players/${steamId}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({})
  })

  test("malformed config file falls back without crashing", async () => {
    const dir = await tempDir()
    await Bun.write(join(dir, "players.json"), "{not json")
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    try {
      const { app } = testApp(dir)
      const response = await app.request("/api/config/players")
      expect(await response.json()).toEqual({})
    } finally {
      console.warn = original
    }
    expect(warnings.some((line) => line.includes("malformed player presentation"))).toBe(true)
  })

  test("skips a bad entry and keeps valid neighbors", async () => {
    const dir = await tempDir()
    await Bun.write(
      join(dir, "players.json"),
      JSON.stringify({
        [steamId]: entry,
        bad: { portrait: { type: "operator", value: "nope" } },
      })
    )
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    try {
      const { app } = testApp(dir)
      expect(await (await app.request("/api/config/players")).json()).toEqual({ [steamId]: entry })
    } finally {
      console.warn = original
    }
    expect(warnings.some((line) => line.includes("malformed player presentation entries"))).toBe(
      true
    )
  })
})

describe("operator portraits", () => {
  test("GET 404s when the local file is missing", async () => {
    const { app } = testApp(await tempDir())
    const missing = await app.request("/api/portraits/ctm_sas_variantf")
    expect(missing.status).toBe(404)
    const traversal = await app.request("/api/portraits/../theme")
    expect(traversal.status).toBe(404)
  })

  test("GET returns a local PNG for a known operator", async () => {
    const dir = await tempDir()
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    await Bun.write(join(dir, "portraits", "ctm_sas_variantf.png"), png)
    const { app } = testApp(dir)
    const response = await app.request("/api/portraits/ctm_sas_variantf", {
      headers: { Origin: "http://localhost:5174" },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
  })

  test("GET returns a custom local portrait file", async () => {
    const dir = await tempDir()
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    await Bun.write(join(dir, "portraits", "nova_lan.png"), png)
    const { app } = testApp(dir)
    const response = await app.request("/api/portraits/nova_lan")
    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
  })
})

describe("realtime presentation", () => {
  test("player presentation update is broadcast to connected clients", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await opened
    await waitFor(() => received.length >= 3)

    const steamId = "76561198000000001"
    const response = await app.request(`/api/config/players/${steamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portrait: { type: "operator", value: "tm_phoenix_variantg" } }),
    })
    expect(response.status).toBe(200)
    await waitFor(() =>
      received.some(
        (message) =>
          isPresentation(message) &&
          message.data[steamId]?.portrait?.value === "tm_phoenix_variantg"
      )
    )
    ws.close()
  })
})

describe("realtime overlay", () => {
  test("broadcast config update is sent to connected clients", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await opened
    await waitFor(() => received.length >= 4)

    const response = await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "BO5" }),
    })
    expect(response.status).toBe(200)
    await waitFor(() =>
      received.some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "broadcast-config" &&
          "data" in message &&
          typeof message.data === "object" &&
          message.data !== null &&
          "format" in message.data &&
          message.data.format === "BO5"
      )
    )
    ws.close()
  })
})

describe("broadcast assets", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])

  test("uploads a team logo, serves it, and clears it", async () => {
    const { app } = testApp(await tempDir())
    const form = new FormData()
    form.set("slot", "left")
    form.set("file", new File([png], "logo.png", { type: "image/png" }))
    const uploaded = await app.request("/api/assets/team-logo", { method: "POST", body: form })
    expect(uploaded.status).toBe(200)
    const body = (await uploaded.json()) as {
      id: string
      config: { teams: { left: { logoAssetId?: string } } }
    }
    expect(body.id.startsWith("team-left-")).toBe(true)
    expect(body.config.teams.left.logoAssetId).toBe(body.id)

    const served = await app.request(`/api/assets/${body.id}`)
    expect(served.status).toBe(200)
    expect(served.headers.get("Content-Type")).toBe("image/png")

    const traversal = await app.request("/api/assets/../theme")
    expect(traversal.status).toBe(404)

    const cleared = await app.request(`/api/assets/${body.id}`, { method: "DELETE" })
    expect(cleared.status).toBe(200)
    expect(await cleared.json()).toMatchObject({ teams: { left: {} } })
    expect((await app.request(`/api/assets/${body.id}`)).status).toBe(404)
  })

  test("rejects missing slot, remote-looking files, and missing assets", async () => {
    const { app } = testApp(await tempDir())
    const noSlot = new FormData()
    noSlot.set("file", new File([png], "logo.png", { type: "image/png" }))
    const missingSlot = await app.request("/api/assets/team-logo", { method: "POST", body: noSlot })
    expect(missingSlot.status).toBe(400)

    const junk = new FormData()
    junk.set("slot", "left")
    junk.set("file", new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], "x.bin"))
    const bad = await app.request("/api/assets/team-logo", { method: "POST", body: junk })
    expect(bad.status).toBe(400)

    const missing = await app.request("/api/assets/team-left-missing", { method: "DELETE" })
    expect(missing.status).toBe(404)
  })

  test("sponsor upload writes an asset id into broadcast config", async () => {
    const { app } = testApp(await tempDir())
    await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "BO1", sponsor: { name: "Local LAN" } }),
    })
    const form = new FormData()
    form.set("file", new File([png], "sponsor.png", { type: "image/png" }))
    const uploaded = await app.request("/api/assets/sponsor", { method: "POST", body: form })
    expect(uploaded.status).toBe(200)
    const body = (await uploaded.json()) as {
      id: string
      config: {
        sponsors?: Array<{
          enabled?: boolean
          name?: string
          assetId?: string
          position?: string
          displayMode?: string
        }>
      }
    }
    expect(body.config.sponsors).toEqual([
      {
        enabled: true,
        name: "Local LAN",
        assetId: body.id,
        position: "top-right",
        displayMode: "logo-text",
      },
    ])
  })
})

describe("broadcast status", () => {
  test("GET /api/status is waiting before any GSI arrives", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/status")
    expect(response.status).toBe(200)
    const body = parseBroadcastStatus(await response.json())
    expect(body).not.toBeNull()
    expect(body?.server).toEqual({ healthy: true })
    expect(body?.gsi).toEqual({ connected: false, stale: false, freshness: "waiting" })
    expect(body?.overlay.connectedClients).toBe(0)
    expect(body?.match).toEqual({ playerCount: 0, radar: "none" })
    expect(body?.readiness.state).toBe("offline")
    expect(Object.keys(body ?? {}).sort()).toEqual(["gsi", "match", "overlay", "readiness", "server"])
    expect(Object.keys(body?.gsi ?? {}).sort()).toEqual(["connected", "freshness", "stale"])
  })

  test("GET /api/status reports a live match after a fixture", async () => {
    const { app } = testApp(await tempDir())
    const posted = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await Bun.file(liveFixturePath).json()),
    })
    expect(posted.status).toBe(204)

    const body = parseBroadcastStatus(await (await app.request("/api/status")).json())
    expect(body?.gsi.connected).toBe(true)
    expect(body?.gsi.freshness).toBe("live")
    expect(body?.gsi.lastUpdateAt).toBeGreaterThan(Date.now() - 2000)
    expect(body?.match.map).toBe("Inferno")
    expect(body?.match.mapId).toBe("de_inferno")
    expect(body?.match.phase).toBe("LIVE")
    expect(body?.match.round).toBe(15)
    expect(body?.match.playerCount).toBe(6)
    expect(body?.match.leftName).toBe("Northwind")
    expect(body?.match.rightName).toBe("Redline")
    expect(body?.match.radar).toBe("ready")
    expect(body?.overlay.connectedClients).toBe(0)
    expect(body?.readiness.state).toBe("warning")
    expect(body?.readiness.issues.map((issue) => issue.code)).toEqual(["overlay_disconnected"])
  })

  test("configured team names appear on /api/status", async () => {
    const { app } = testApp(await tempDir())
    await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO1",
        teams: { left: { name: "SquadVault" }, right: { name: "Velos" } },
      }),
    })
    await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await Bun.file(liveFixturePath).json()),
    })
    const body = parseBroadcastStatus(await (await app.request("/api/status")).json())
    expect(body?.match.leftName).toBe("SquadVault")
    expect(body?.match.rightName).toBe("Velos")
  })

  test("overlay client count follows WebSocket connect and close", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const before = parseBroadcastStatus(await (await app.request("/api/status")).json())
    expect(before?.overlay.connectedClients).toBe(0)

    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    await waitFor(async () => {
      const body = parseBroadcastStatus(await (await app.request("/api/status")).json())
      return body?.overlay.connectedClients === 1
    })

    ws.close()
    await waitFor(async () => {
      const body = parseBroadcastStatus(await (await app.request("/api/status")).json())
      return body?.overlay.connectedClients === 0
    })
  })
})

describe("setup", () => {
  test("GET /api/setup reports CS2 integration status", async () => {
    const { io } = await tempSteamLayout()
    const { app } = testApp(await tempDir(), io)
    const response = await app.request("/api/setup")
    expect(response.status).toBe(200)
    const body = parseSetupStatus(await response.json())
    expect(body?.cs2.found).toBe(true)
    expect(body?.cs2.gsi.state).toBe("not-installed")
    expect(body?.gsiUri).toContain("/api/gsi")
  })

  test("POST /api/setup/gsi/install writes the managed cfg", async () => {
    const { io, cfgDir } = await tempSteamLayout()
    const { app } = testApp(await tempDir(), io)
    const response = await app.request("/api/setup/gsi/install", { method: "POST" })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { setup: unknown; restartRequired: boolean }
    expect(body.restartRequired).toBe(true)
    const setup = parseSetupStatus(body.setup)
    expect(setup?.cs2.gsi.state).toBe("installed")
    expect(await Bun.file(join(cfgDir, "gamestate_integration_matchframe.cfg")).exists()).toBe(true)
  })

  test("GET /api/setup/gsi.cfg downloads the template", async () => {
    const { app } = testApp(await tempDir())
    const response = await app.request("/api/setup/gsi.cfg")
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain("Matchframe GSI")
    expect(text).toContain("http://127.0.0.1:")
    expect(response.headers.get("Content-Disposition")).toContain("gamestate_integration_matchframe.cfg")
  })
})

describe("match reset", () => {
  test("POST /api/match/reset clears runtime match state and preserves config", async () => {
    const dir = await tempDir()
    const { app, gsi, store, overlayStore, themeStore, playerStore } = testApp(dir)
    await app.request("/api/config/broadcast", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "BO3",
        teams: { left: { name: "SquadVault" }, right: { name: "Velos" } },
      }),
    })
    await app.request("/api/config/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...defaultTheme, accent: "#445566" }),
    })
    await app.request("/api/config/players/76561198000000001", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "n0thing" }),
    })

    const live = await loadGsiFixture("live")
    expect(
      (
        await app.request("/api/gsi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(live),
        })
      ).status
    ).toBe(204)
    expect(store.current?.players.length).toBeGreaterThan(0)
    expect(store.current?.map.name).toBe("de_inferno")
    expect(store.current?.bomb).toBeTruthy()

    const planted = await loadGsiFixture("bomb-planted")
    await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planted),
    })

    const reset = await app.request("/api/match/reset", { method: "POST" })
    expect(reset.status).toBe(204)
    expect(store.current).toBeNull()
    expect(gsiLooksEmpty(gsi.getState())).toBe(true)

    const status = parseBroadcastStatus(await (await app.request("/api/status")).json())
    expect(status?.gsi.freshness).toBe("waiting")
    expect(status?.match.playerCount).toBe(0)

    expect(overlayStore.get().teams.left.name).toBe("SquadVault")
    expect(themeStore.get().accent).toBe("#445566")
    expect(playerStore.get()["76561198000000001"]?.displayName).toBe("n0thing")

    const next = await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await loadGsiFixture("live")),
    })
    expect(next.status).toBe(204)
    expect(store.current?.map.name).toBe("de_inferno")
    expect(store.current?.players.length).toBeGreaterThan(0)
  })

  test("connected overlay receives match-reset and a new client gets no stale snapshot", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await loadGsiFixture("live")),
    })

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await opened
    await waitFor(() => received.some((message) => isSnapshot(message)))

    await app.request("/api/match/reset", { method: "POST" })
    await waitFor(() => received.some((message) => isMatchReset(message)))
    ws.close()

    const reconnect = await collectWsMessages(`ws://127.0.0.1:${server.port}/ws`, 4)
    expect(reconnect.map((message) => message.type)).toEqual([
      "connection",
      "theme",
      "presentation",
      "broadcast-config",
    ])
    expect(reconnect.some((message) => message.type === "snapshot")).toBe(false)
    expect(reconnect[0]).toEqual({ type: "connection", data: { connected: false } })
  })

  test("first snapshot after reset does not emit leftover match events", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await loadGsiFixture("live")),
    })
    await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await loadGsiFixture("round-ct-win")),
    })

    const received: unknown[] = []
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("websocket error"))
    })
    ws.onmessage = (event) => {
      received.push(parseServerMessage(typeof event.data === "string" ? event.data : null))
    }
    await waitFor(() => received.some((message) => isSnapshot(message)))
    const before = received.length

    await app.request("/api/match/reset", { method: "POST" })
    await waitFor(() => received.some((message) => isMatchReset(message)))

    await app.request("/api/gsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await loadGsiFixture("bomb-planted")),
    })
    await waitFor(() => received.slice(before).filter(isSnapshot).length >= 1)

    const afterReset = received.slice(before)
    expect(afterReset.some((message) => isMatchReset(message))).toBe(true)
    expect(
      afterReset.some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "event"
      )
    ).toBe(false)
    ws.close()
  })
})

function isPresentation(
  message: unknown
): message is { type: "presentation"; data: Record<string, { portrait?: { value: string } }> } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "presentation"
  )
}

function isTheme(
  message: unknown
): message is { type: "theme"; data: { accent: string } } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "theme"
  )
}

function isBroadcastConfig(
  message: unknown
): message is {
  type: "broadcast-config"
  data: { sponsors?: Array<{ enabled?: boolean; name?: string; position?: string }> }
} {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "broadcast-config"
  )
}

function isSnapshot(message: unknown): message is { type: "snapshot" } {
  return typeof message === "object" && message !== null && "type" in message && message.type === "snapshot"
}

function isMatchReset(message: unknown): message is { type: "match-reset" } {
  return typeof message === "object" && message !== null && "type" in message && message.type === "match-reset"
}

function gsiLooksEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return record.map === undefined && record.allplayers === undefined && record.player === undefined
}

async function tempSteamLayout(): Promise<{ io: SetupIo; cfgDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "matchframe-setup-"))
  const linux = process.platform !== "win32"
  const steam = linux ? join(root, ".local", "share", "Steam") : join(root, "Steam")
  const cfgDir = join(
    steam,
    "steamapps",
    "common",
    "Counter-Strike Global Offensive",
    "game",
    "csgo",
    "cfg"
  )
  await mkdir(cfgDir, { recursive: true })
  await writeFile(
    join(steam, "steamapps", "libraryfolders.vdf"),
    `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${steam.replaceAll("\\", "\\\\")}"\n\t\t"apps"\n\t\t{\n\t\t\t"730"\t\t"1"\n\t\t}\n\t}\n}\n`,
    "utf8"
  )
  const io: SetupIo = {
    platform: linux ? "linux" : "win32",
    homedir: linux ? root : join(root, "Users"),
    env: {},
    path: pathApiFor(linux ? "linux" : "win32"),
    fs: {
      async isDir(target) {
        try {
          return (await stat(target)).isDirectory()
        } catch {
          return false
        }
      },
      async isFile(target) {
        try {
          return (await stat(target)).isFile()
        } catch {
          return false
        }
      },
      async readFile(target) {
        try {
          return await readFile(target, "utf8")
        } catch {
          return null
        }
      },
    },
    writeFile: async (target, contents) => {
      await writeFile(target, contents, "utf8")
    },
    ...(linux ? {} : { windowsSteamRoots: async () => [steam] }),
  }
  return { io, cfgDir }
}

function isActiveInterstitial(
  message: unknown
): message is { type: "interstitial"; data: { card: { type: string } } } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "interstitial" &&
    "data" in message &&
    message.data !== null
  )
}

async function collectWsMessages(url: string, count: number) {
  const ws = new WebSocket(url)
  const messages: NonNullable<ReturnType<typeof parseServerMessage>>[] = []
  const done = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out waiting for websocket messages")), 3000)
    ws.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("websocket error"))
    }
    ws.onmessage = (event) => {
      const parsed = parseServerMessage(typeof event.data === "string" ? event.data : null)
      if (!parsed) {
        return
      }
      messages.push(parsed)
      if (messages.length >= count) {
        clearTimeout(timeout)
        resolve()
      }
    }
  })
  await done
  ws.close()
  return messages
}

async function waitFor(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const started = Date.now()
  while (!(await predicate())) {
    if (Date.now() - started > 3000) {
      throw new Error("timed out waiting for condition")
    }
    await Bun.sleep(20)
  }
}
