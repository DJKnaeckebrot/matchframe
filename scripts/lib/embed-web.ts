import { readdir } from "node:fs/promises"
import { join } from "node:path"

function toPosix(path: string): string {
  return path.replace(/\\/g, "/")
}

async function listRelative(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string, prefix: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), relative)
      } else if (!entry.name.endsWith(".map")) {
        out.push(relative)
      }
    }
  }
  await walk(root, "")
  out.sort()
  return out
}

export async function generateEmbeddedModule(webDir: string, importRoot: string): Promise<string> {
  const dashboard = await listRelative(join(webDir, "dashboard"))
  const overlay = await listRelative(join(webDir, "overlay"))
  if (dashboard.length === 0 || overlay.length === 0) {
    throw new Error("Frontend assets are missing from the compile staging directory")
  }
  const root = toPosix(importRoot).replace(/\/$/, "")
  const lines = ["export type EmbeddedFiles = Record<string, string>", ""]
  const dashboardIds: string[] = []
  const overlayIds: string[] = []
  dashboard.forEach((relative, index) => {
    const id = `d${String(index)}`
    dashboardIds.push(id)
    lines.push(`import ${id} from "${root}/dashboard/${toPosix(relative)}" with { type: "file" }`)
  })
  overlay.forEach((relative, index) => {
    const id = `o${String(index)}`
    overlayIds.push(id)
    lines.push(`import ${id} from "${root}/overlay/${toPosix(relative)}" with { type: "file" }`)
  })
  lines.push("")
  lines.push("export const embeddedDashboard: EmbeddedFiles = {")
  dashboard.forEach((relative, index) => {
    lines.push(`  ${JSON.stringify(toPosix(relative))}: ${dashboardIds[index]},`)
  })
  lines.push("}")
  lines.push("")
  lines.push("export const embeddedOverlay: EmbeddedFiles = {")
  overlay.forEach((relative, index) => {
    lines.push(`  ${JSON.stringify(toPosix(relative))}: ${overlayIds[index]},`)
  })
  lines.push("}")
  lines.push("")
  return lines.join("\n")
}
