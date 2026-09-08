import { copyFile, mkdir, unlink } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  emptyPlayerPresentationConfig,
  isEmptyPresentation,
  playerPresentationSchema,
  steamIdSchema,
  type PlayerPresentation,
  type PlayerPresentationConfig,
} from "@workspace/presentation"

export type PlayerStore = {
  get(): PlayerPresentationConfig
  upsert(steamId: string, entry: PlayerPresentation): Promise<PlayerPresentationConfig>
  remove(steamId: string): Promise<PlayerPresentationConfig>
}

export function createFilePlayerStore(dir: string): PlayerStore {
  const file = join(dir, "players.json")
  let current = loadPlayers(file)

  return {
    get() {
      return current
    },
    async upsert(steamId, entry) {
      const next = compactConfig(current, steamId, entry)
      await persist(dir, file, next)
      current = next
      return current
    },
    async remove(steamId) {
      if (!(steamId in current)) {
        return current
      }
      const next = { ...current }
      delete next[steamId]
      await persist(dir, file, next)
      current = next
      return current
    },
  }
}

function compactConfig(
  current: PlayerPresentationConfig,
  steamId: string,
  entry: PlayerPresentation
): PlayerPresentationConfig {
  const compact = compactEntry(entry)
  const next = { ...current }
  if (!compact) {
    delete next[steamId]
  } else {
    next[steamId] = compact
  }
  return next
}

export function compactEntry(entry: PlayerPresentation): PlayerPresentation | null {
  const displayName = entry.displayName?.trim()
  const next: PlayerPresentation = {
    ...(displayName ? { displayName } : {}),
    ...(entry.portrait ? { portrait: entry.portrait } : {}),
  }
  return isEmptyPresentation(next) ? null : next
}

async function persist(dir: string, file: string, config: PlayerPresentationConfig): Promise<void> {
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, "players.json.tmp")
  await Bun.write(tmp, `${JSON.stringify(config, null, 2)}\n`)
  await copyFile(tmp, file)
  await unlink(tmp)
}

function loadPlayers(file: string): PlayerPresentationConfig {
  if (!existsSync(file)) {
    return emptyPlayerPresentationConfig
  }

  try {
    const raw: unknown = JSON.parse(readFileSync(file, "utf8"))
    if (!isRecord(raw)) {
      console.warn("Matchframe: ignoring malformed player presentation config")
      return emptyPlayerPresentationConfig
    }

    const loaded: Record<string, PlayerPresentation> = {}
    let skipped = 0
    for (const [steamId, entry] of Object.entries(raw)) {
      const id = steamIdSchema.safeParse(steamId)
      const parsed = playerPresentationSchema.safeParse(entry)
      if (!id.success || !parsed.success) {
        skipped += 1
        continue
      }
      const compact = compactEntry(parsed.data)
      if (compact) {
        loaded[id.data] = compact
      }
    }
    if (skipped > 0) {
      console.warn("Matchframe: ignoring malformed player presentation entries")
    }
    return loaded
  } catch {
    console.warn("Matchframe: ignoring malformed player presentation config")
    return emptyPlayerPresentationConfig
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
