import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"

import { fileResponse, mappedResponse, mountFrontend, resolveWebRoots, shouldServeFrontend } from "./static"

async function webTree(): Promise<{ dashboardDir: string; overlayDir: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "matchframe-web-"))
  const dashboardDir = join(root, "dashboard")
  const overlayDir = join(root, "overlay")
  await mkdir(join(dashboardDir, "assets"), { recursive: true })
  await mkdir(join(overlayDir, "assets"), { recursive: true })
  await writeFile(join(dashboardDir, "index.html"), "<!doctype html><title>dash</title>")
  await writeFile(join(dashboardDir, "assets", "app.js"), "console.log('dash')")
  await writeFile(join(overlayDir, "index.html"), "<!doctype html><title>overlay</title>")
  await writeFile(join(overlayDir, "assets", "hud.js"), "console.log('hud')")
  return { dashboardDir, overlayDir, root }
}

describe("production static routes", () => {
  test("serves dashboard at / and overlay at /overlay from compiled resource dirs", async () => {
    const { dashboardDir, overlayDir, root } = await webTree()
    const app = new Hono()
    app.get("/health", (c) => c.json({ status: "ok" }))
    app.get("/api/status", (c) => c.json({ ok: true }))
    mountFrontend(app, { dashboardDir, overlayDir })

    const dash = await app.request("/")
    expect(dash.status).toBe(200)
    expect(await dash.text()).toContain("dash")

    const overlay = await app.request("/overlay/")
    expect(overlay.status).toBe(200)
    expect(await overlay.text()).toContain("overlay")

    const redirect = await app.request("/overlay")
    expect(redirect.status).toBe(302)
    expect(redirect.headers.get("Location")).toBe("/overlay/")

    const hud = await app.request("/overlay/assets/hud.js")
    expect(hud.status).toBe(200)
    expect(await hud.text()).toContain("hud")

    const health = await app.request("/health")
    expect(health.status).toBe(200)

    const traversal = await fileResponse(dashboardDir, "/../overlay/index.html")
    expect(traversal).toBeNull()

    const resolved = resolveWebRoots(root, root)
    expect(resolved?.dashboardDir).toBe(dashboardDir)
    expect(resolved?.overlayDir).toBe(overlayDir)
    expect(resolveWebRoots(join(root, "missing"), join(root, "missing"))).toBeNull()

    const mapped = await mappedResponse(
      { "index.html": join(dashboardDir, "index.html") },
      "/index.html"
    )
    expect(mapped?.status).toBe(200)
    expect(await mapped?.text()).toContain("dash")
  })

  test("development does not serve web unless explicitly requested", () => {
    expect(shouldServeFrontend({}, false)).toBe(false)
    expect(shouldServeFrontend({ NODE_ENV: "production" }, false)).toBe(true)
    expect(shouldServeFrontend({}, true)).toBe(true)
    expect(shouldServeFrontend({ MATCHFRAME_SERVE_WEB: "0" }, true)).toBe(false)
  })
})
