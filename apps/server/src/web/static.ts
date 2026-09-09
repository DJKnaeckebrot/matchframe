import { existsSync, readdirSync, statSync } from "node:fs"
import { join, normalize, sep } from "node:path"
import type { Hono } from "hono"

import { embeddedDashboard, embeddedOverlay } from "./embedded"

export type WebRoots = {
  dashboardDir: string
  overlayDir: string
}

export type FrontendSource =
  | WebRoots
  | {
      dashboard: Record<string, string>
      overlay: Record<string, string>
    }

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
}

export function hasEmbeddedFrontend(): boolean {
  return Object.keys(embeddedDashboard).length > 0 && Object.keys(embeddedOverlay).length > 0
}

export function embeddedFrontend(): { dashboard: Record<string, string>; overlay: Record<string, string> } {
  return { dashboard: embeddedDashboard, overlay: embeddedOverlay }
}

export function shouldServeFrontend(env: NodeJS.ProcessEnv, standalone: boolean): boolean {
  if (env.MATCHFRAME_SERVE_WEB === "0") {
    return false
  }
  return standalone || env.MATCHFRAME_SERVE_WEB === "1" || env.NODE_ENV === "production"
}

export function resolveWebRoots(metaDir: string, cwd: string): WebRoots | null {
  const dashboardDir = firstIndex(
    join(metaDir, "web", "dashboard"),
    join(metaDir, "dashboard"),
    join(metaDir, "dist", "compile-assets", "web", "dashboard"),
    join(metaDir, "..", "..", "dashboard", "dist"),
    join(cwd, "web", "dashboard"),
    ...findNamedIndexDirs(metaDir, "dashboard", 5)
  )
  const overlayDir = firstIndex(
    join(metaDir, "web", "overlay"),
    join(metaDir, "overlay"),
    join(metaDir, "dist", "compile-assets", "web", "overlay"),
    join(metaDir, "..", "..", "overlay", "dist"),
    join(cwd, "web", "overlay"),
    ...findNamedIndexDirs(metaDir, "overlay", 5)
  )
  if (!dashboardDir || !overlayDir) {
    return null
  }
  return { dashboardDir, overlayDir }
}

export function mountFrontend(app: Hono, roots: FrontendSource): void {
  const overlay = (path: string) =>
    "overlayDir" in roots ? fileResponse(roots.overlayDir, path) : mappedResponse(roots.overlay, path)
  const dashboard = (path: string) =>
    "dashboardDir" in roots ? fileResponse(roots.dashboardDir, path) : mappedResponse(roots.dashboard, path)

  app.get("/overlay", (c) => c.redirect("/overlay/", 302))
  app.get("/overlay/", async () => (await overlay("/index.html")) ?? notFound())
  app.get("/overlay/*", async (c) => {
    const rest = c.req.path.slice("/overlay".length)
    return (await overlay(rest === "/" ? "/index.html" : rest)) ?? notFound()
  })
  app.get("/", async () => (await dashboard("/index.html")) ?? notFound())
  app.get("/*", async (c) => {
    const path = c.req.path
    if (path.startsWith("/api") || path === "/ws" || path === "/health" || path.startsWith("/overlay")) {
      return notFound()
    }
    return (await dashboard(path)) ?? notFound()
  })
}

export async function mappedResponse(files: Record<string, string>, urlPath: string): Promise<Response | null> {
  const relative = posixRelative(urlPath)
  if (!relative || relative.split("/").includes("..")) {
    return null
  }
  const target = files[relative]
  if (!target) {
    return null
  }
  const ext = extension(target) || extension(relative)
  const cache = relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache"
  return new Response(Bun.file(target), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": cache,
    },
  })
}

function posixRelative(urlPath: string): string | null {
  const relative = decodeURIComponent(urlPath.replace(/^\/+/, ""))
  if (relative.includes("\0") || relative.includes("\\")) {
    return null
  }
  return relative || "index.html"
}

export async function fileResponse(root: string, urlPath: string): Promise<Response | null> {
  const relative = decodeURIComponent(urlPath.replace(/^\/+/, ""))
  if (relative.includes("\0") || relative.split(/[/\\]/).includes("..")) {
    return null
  }
  const target = normalize(join(root, relative || "index.html"))
  if (!isInside(root, target) || !existsSync(target)) {
    return null
  }
  try {
    if (!statSync(target).isFile()) {
      return null
    }
  } catch {
    return null
  }
  const ext = extension(target)
  const cache =
    relative.startsWith("assets/") || relative.includes("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache"
  return new Response(Bun.file(target), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": cache,
    },
  })
}

function findNamedIndexDirs(root: string, folderName: string, depth: number): string[] {
  const found: string[] = []
  walk(root, folderName, depth, found)
  return found
}

function walk(dir: string, folderName: string, depth: number, found: string[]): void {
  if (depth < 0 || found.length > 0) {
    return
  }
  const candidate = join(dir, folderName)
  if (existsSync(join(candidate, "index.html"))) {
    found.push(candidate)
    return
  }
  if (depth === 0) {
    return
  }
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) {
      continue
    }
    const next = join(dir, name)
    try {
      if (!statSync(next).isDirectory()) {
        continue
      }
    } catch {
      continue
    }
    walk(next, folderName, depth - 1, found)
    if (found.length > 0) {
      return
    }
  }
}

function firstIndex(...dirs: string[]): string | null {
  for (const dir of dirs) {
    if (existsSync(join(dir, "index.html"))) {
      return dir
    }
  }
  return null
}

function isInside(root: string, target: string): boolean {
  const base = normalize(root)
  const next = normalize(target)
  return next === base || next.startsWith(base.endsWith(sep) ? base : base + sep)
}

function extension(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  const name = slash === -1 ? path : path.slice(slash + 1)
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot).toLowerCase()
}

function notFound(): Response {
  return new Response("Not found", { status: 404 })
}
