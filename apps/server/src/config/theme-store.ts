import { copyFile, mkdir, unlink } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { defaultTheme, matchframeThemeSchema } from "@workspace/theme"
import type { MatchframeTheme } from "@workspace/theme"

export type ThemeStore = {
  get(): MatchframeTheme
  set(theme: MatchframeTheme): Promise<MatchframeTheme>
}

export function createFileThemeStore(dir: string): ThemeStore {
  const file = join(dir, "theme.json")
  let current = loadTheme(file)

  return {
    get() {
      return current
    },
    async set(theme) {
      await mkdir(dir, { recursive: true })
      const tmp = join(dir, "theme.json.tmp")
      await Bun.write(tmp, `${JSON.stringify(theme, null, 2)}\n`)
      await copyFile(tmp, file)
      await unlink(tmp)
      current = theme
      return current
    },
  }
}

function loadTheme(file: string): MatchframeTheme {
  if (!existsSync(file)) {
    return { ...defaultTheme }
  }

  try {
    const parsed = matchframeThemeSchema.safeParse(JSON.parse(readFileSync(file, "utf8")))
    if (parsed.success) {
      return parsed.data
    }
  } catch {
    // JSON.parse or read failure falls through to the same warning.
  }

  console.warn("Matchframe: ignoring malformed theme config, using defaults")
  return { ...defaultTheme }
}
