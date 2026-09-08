import { copyFile, mkdir, unlink } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { compactOverlayConfig, defaultOverlayConfig, overlayConfigSchema } from "@workspace/presentation"
import type { OverlayConfig } from "@workspace/presentation"

export type OverlayStore = {
  get(): OverlayConfig
  set(overlay: OverlayConfig): Promise<OverlayConfig>
}

export function createFileOverlayStore(dir: string): OverlayStore {
  const file = join(dir, "overlay.json")
  let current = loadOverlay(file)

  return {
    get() {
      return current
    },
    async set(overlay) {
      const next = compactOverlayConfig(overlay)
      await mkdir(dir, { recursive: true })
      const tmp = join(dir, "overlay.json.tmp")
      await Bun.write(tmp, `${JSON.stringify(next, null, 2)}\n`)
      await copyFile(tmp, file)
      await unlink(tmp)
      current = next
      return current
    },
  }
}

function loadOverlay(file: string): OverlayConfig {
  if (!existsSync(file)) {
    return { ...defaultOverlayConfig }
  }

  try {
    const parsed = overlayConfigSchema.safeParse(JSON.parse(readFileSync(file, "utf8")))
    if (parsed.success) {
      return compactOverlayConfig(parsed.data)
    }
  } catch {
    // JSON.parse or read failure falls through to the same warning.
  }

  console.warn("Matchframe: ignoring malformed overlay config, using defaults")
  return { ...defaultOverlayConfig }
}
