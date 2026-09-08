import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import { createGameStateEngine, parseServerMessage } from "@workspace/game-state"
import type { GameState } from "@workspace/game-state"
import { defaultTheme } from "@workspace/theme"
import { websocket } from "hono/bun"

import { createApp } from "./app"
import { createFileThemeStore } from "./config/theme-store"
import { createRealtimeHub } from "./hub"

const liveFixturePath = new URL("../../../packages/gsi/fixtures/inferno-live.json", import.meta.url)

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "matchframe-theme-"))
}

function testApp(dir: string) {
  const store: { current: GameState | null } = { current: null }
  const hub = createRealtimeHub()
  const themeStore = createFileThemeStore(dir)
  const app = createApp({
    engine: createGameStateEngine(),
    getState: () => store.current,
    setState: (state) => {
      store.current = state
    },
    themeStore,
    hub,
  })
  return { app, hub, themeStore }
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

describe("realtime theme", () => {
  test("a new client receives connection then theme", async () => {
    const { app } = testApp(await tempDir())
    const server = Bun.serve({
      port: 0,
      fetch: (req, server) => app.fetch(req, server),
      websocket,
    })
    servers.push(server)

    const messages = await collectWsMessages(`ws://127.0.0.1:${server.port}/ws`, 2)
    expect(messages.map((message) => message.type)).toEqual(["connection", "theme"])
    expect(messages[1]).toEqual({ type: "theme", data: defaultTheme })
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
    await waitFor(() => received.length >= 2)

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

    const messages = await collectWsMessages(`ws://127.0.0.1:${server.port}/ws`, 3)
    expect(messages.map((message) => message.type)).toEqual(["connection", "theme", "snapshot"])
  })
})

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

async function waitFor(predicate: () => boolean): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > 3000) {
      throw new Error("timed out waiting for condition")
    }
    await Bun.sleep(20)
  }
}
