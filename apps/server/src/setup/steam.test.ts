import { describe, expect, test } from "bun:test"

import { discoverCs2, pathApiFor, type SteamDiscoveryDeps, type SteamDiscoveryFs } from "./steam"

function memoryFs(options: {
  dirs?: readonly string[]
  files?: Record<string, string>
  win?: boolean
}): SteamDiscoveryFs {
  const win = options.win === true
  const dirs = new Set((options.dirs ?? []).map((entry) => norm(entry, win)))
  const files = new Map(
    Object.entries(options.files ?? {}).map(([path, contents]) => [norm(path, win), contents])
  )
  for (const filePath of files.keys()) {
    addParents(filePath, dirs, win)
  }
  for (const dir of [...dirs]) {
    addParents(dir, dirs, win)
  }

  return {
    async isDir(target) {
      return dirs.has(norm(target, win)) && !files.has(norm(target, win))
    },
    async isFile(target) {
      return files.has(norm(target, win))
    },
    async readFile(target) {
      return files.get(norm(target, win)) ?? null
    },
  }
}

function norm(value: string, win: boolean): string {
  const trimmed = value.replace(/[\\/]+$/, "")
  return win ? trimmed.replaceAll("/", "\\").toLowerCase() : trimmed
}

function addParents(target: string, dirs: Set<string>, win: boolean): void {
  const sep = win ? "\\" : "/"
  const parts = norm(target, win).split(sep)
  for (let i = 1; i < parts.length; i += 1) {
    dirs.add(parts.slice(0, i).join(sep))
  }
}

function cs2Cfg(library: string, win: boolean): string {
  const path = pathApiFor(win ? "win32" : "linux")
  return path.join(library, "steamapps", "common", "Counter-Strike Global Offensive", "game", "csgo", "cfg")
}

function windowsDeps(overrides: Partial<SteamDiscoveryDeps> & { fs: SteamDiscoveryFs }): SteamDiscoveryDeps {
  return {
    platform: "win32",
    homedir: "C:\\Users\\operator",
    env: { "ProgramFiles(x86)": "C:\\Program Files (x86)", ProgramFiles: "C:\\Program Files" },
    path: pathApiFor("win32"),
    windowsSteamRoots: async () => ["C:\\Program Files (x86)\\Steam"],
    ...overrides,
  }
}

const DEFAULT_STEAM = "C:\\Program Files (x86)\\Steam"
const SECONDARY = "D:\\SteamLibrary"

function libraryVdf(entries: readonly { path: string; apps: readonly string[] }[]): string {
  const blocks = entries.map((entry, index) => {
    const apps = entry.apps.map((id) => `\t\t\t"${id}"\t\t"1"`).join("\n")
    return `\t"${String(index)}"\n\t{\n\t\t"path"\t\t"${entry.path.replaceAll("\\", "\\\\")}"\n\t\t"apps"\n\t\t{\n${apps}\n\t\t}\n\t}`
  })
  return `"libraryfolders"\n{\n${blocks.join("\n")}\n}\n`
}

describe("discoverCs2 windows", () => {
  test("default Windows Steam library", async () => {
    const cfg = cs2Cfg(DEFAULT_STEAM, true)
    const result = await discoverCs2(
      windowsDeps({
        fs: memoryFs({
          win: true,
          dirs: [DEFAULT_STEAM, cfg],
          files: {
            [`${DEFAULT_STEAM}\\steamapps\\libraryfolders.vdf`]: libraryVdf([
              { path: DEFAULT_STEAM, apps: ["730"] },
            ]),
          },
        }),
      })
    )
    expect(result).toEqual({
      state: "found",
      steamRoot: DEFAULT_STEAM,
      libraryPath: DEFAULT_STEAM,
      cfgDirectory: cfg,
    })
  })

  test("app 730 in a secondary Windows Steam library", async () => {
    const secondaryCfg = cs2Cfg(SECONDARY, true)
    const defaultCfg = cs2Cfg(DEFAULT_STEAM, true)
    const result = await discoverCs2(
      windowsDeps({
        fs: memoryFs({
          win: true,
          dirs: [DEFAULT_STEAM, SECONDARY, defaultCfg, secondaryCfg],
          files: {
            [`${DEFAULT_STEAM}\\steamapps\\libraryfolders.vdf`]: libraryVdf([
              { path: DEFAULT_STEAM, apps: ["228980"] },
              { path: SECONDARY, apps: ["730"] },
            ]),
          },
        }),
      })
    )
    expect(result.state).toBe("found")
    if (result.state === "found") {
      expect(result.libraryPath).toBe(SECONDARY)
      expect(result.cfgDirectory).toBe(secondaryCfg)
    }
  })

  test("Steam found but CS2 is not installed", async () => {
    const result = await discoverCs2(
      windowsDeps({
        fs: memoryFs({
          win: true,
          dirs: [DEFAULT_STEAM],
          files: {
            [`${DEFAULT_STEAM}\\steamapps\\libraryfolders.vdf`]: libraryVdf([
              { path: DEFAULT_STEAM, apps: ["228980"] },
            ]),
          },
        }),
      })
    )
    expect(result).toEqual({ state: "cs2-not-found", steamRoot: DEFAULT_STEAM })
  })

  test("malformed libraryfolders.vdf still inspects the default library", async () => {
    const result = await discoverCs2(
      windowsDeps({
        fs: memoryFs({
          win: true,
          dirs: [DEFAULT_STEAM],
          files: {
            [`${DEFAULT_STEAM}\\steamapps\\libraryfolders.vdf`]: "not a vdf {",
          },
        }),
      })
    )
    expect(result).toEqual({ state: "cs2-not-found", steamRoot: DEFAULT_STEAM })
  })

  test("missing Steam", async () => {
    const result = await discoverCs2(
      windowsDeps({
        windowsSteamRoots: async () => [],
        env: {},
        fs: memoryFs({ win: true, dirs: [] }),
      })
    )
    expect(result).toEqual({ state: "cs2-not-found" })
  })
})

describe("discoverCs2 linux", () => {
  test("Linux default library", async () => {
    const steam = "/home/operator/.local/share/Steam"
    const cfg = cs2Cfg(steam, false)
    const result = await discoverCs2({
      platform: "linux",
      homedir: "/home/operator",
      env: {},
      path: pathApiFor("linux"),
      fs: memoryFs({
        dirs: [steam, cfg],
        files: {
          [`${steam}/steamapps/libraryfolders.vdf`]: `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${steam}"\n\t\t"apps"\n\t\t{\n\t\t\t"730"\t\t"1"\n\t\t}\n\t}\n}\n`,
        },
      }),
    })
    expect(result).toEqual({
      state: "found",
      steamRoot: steam,
      libraryPath: steam,
      cfgDirectory: cfg,
    })
  })
})

describe("discoverCs2 unsupported", () => {
  test("does not claim macOS CS2 support", async () => {
    const result = await discoverCs2({
      platform: "darwin",
      homedir: "/Users/operator",
      env: {},
      path: pathApiFor("linux"),
      fs: memoryFs({ dirs: [] }),
    })
    expect(result.state).toBe("unsupported")
  })
})
