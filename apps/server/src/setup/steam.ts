import path from "node:path"

import { parseLibraryFolders } from "./vdf"

export type PathApi = Pick<typeof path.posix, "join" | "dirname" | "basename" | "isAbsolute"> & {
  sep: string
}

export type SteamDiscoveryFs = {
  isDir(path: string): Promise<boolean>
  isFile(path: string): Promise<boolean>
  readFile(path: string): Promise<string | null>
}

export type SteamDiscoveryDeps = {
  platform: NodeJS.Platform
  homedir: string
  env: NodeJS.ProcessEnv
  path: PathApi
  fs: SteamDiscoveryFs
  windowsSteamRoots?: () => Promise<readonly string[]>
}

export type Cs2Discovery =
  | { state: "found"; steamRoot: string; libraryPath: string; cfgDirectory: string }
  | { state: "cs2-not-found"; steamRoot?: string }
  | { state: "unsupported"; reason: string }

const CS2_CFG_SUFFIX = ["steamapps", "common", "Counter-Strike Global Offensive", "game", "csgo", "cfg"] as const
const APP_ID = "730"

export function pathApiFor(platform: NodeJS.Platform): PathApi {
  return platform === "win32" ? path.win32 : path.posix
}

export function setupPlatform(platform: NodeJS.Platform): "windows" | "linux" | "unsupported" {
  if (platform === "win32") {
    return "windows"
  }
  if (platform === "linux") {
    return "linux"
  }
  return "unsupported"
}

export async function discoverCs2(deps: SteamDiscoveryDeps): Promise<Cs2Discovery> {
  if (deps.platform !== "win32" && deps.platform !== "linux") {
    return {
      state: "unsupported",
      reason: "CS2 setup is not available on this platform.",
    }
  }

  const roots = await resolveSteamRoots(deps)
  if (roots.length === 0) {
    return { state: "cs2-not-found" }
  }

  for (const steamRoot of roots) {
    const libraries = await librariesFor(steamRoot, deps)
    const ranked = await rankLibraries(libraries, deps)
    for (const library of ranked) {
      const cfgDirectory = cs2CfgDirectory(library.path, deps.path)
      if (await deps.fs.isDir(cfgDirectory)) {
        return {
          state: "found",
          steamRoot,
          libraryPath: library.path,
          cfgDirectory,
        }
      }
    }
  }

  return { state: "cs2-not-found", steamRoot: roots[0] }
}

async function resolveSteamRoots(deps: SteamDiscoveryDeps): Promise<string[]> {
  const candidates: string[] = []
  if (deps.platform === "win32") {
    const fromRegistry = deps.windowsSteamRoots ? await deps.windowsSteamRoots() : []
    candidates.push(...fromRegistry)
    const programFilesX86 = deps.env["ProgramFiles(x86)"]
    const programFiles = deps.env.ProgramFiles
    if (programFilesX86) {
      candidates.push(deps.path.join(programFilesX86, "Steam"))
    }
    if (programFiles) {
      candidates.push(deps.path.join(programFiles, "Steam"))
    }
  } else {
    candidates.push(
      deps.path.join(deps.homedir, ".steam", "steam"),
      deps.path.join(deps.homedir, ".steam", "root"),
      deps.path.join(deps.homedir, ".local", "share", "Steam")
    )
    const xdg = deps.env.XDG_DATA_HOME
    if (xdg) {
      candidates.push(deps.path.join(xdg, "Steam"))
    }
    candidates.push(
      deps.path.join(deps.homedir, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam")
    )
  }

  const unique: string[] = []
  for (const candidate of candidates) {
    const normalized = normalizeExisting(candidate)
    if (unique.some((entry) => samePath(entry, normalized, deps.path))) {
      continue
    }
    if (await deps.fs.isDir(normalized)) {
      unique.push(normalized)
    }
  }
  return unique
}

async function librariesFor(
  steamRoot: string,
  deps: SteamDiscoveryDeps
): Promise<{ path: string; appIds: readonly string[] }[]> {
  const vdfPaths = [
    deps.path.join(steamRoot, "steamapps", "libraryfolders.vdf"),
    deps.path.join(steamRoot, "config", "libraryfolders.vdf"),
  ]
  const libraries: { path: string; appIds: readonly string[] }[] = [{ path: steamRoot, appIds: [] }]
  for (const vdfPath of vdfPaths) {
    const text = await deps.fs.readFile(vdfPath)
    if (!text) {
      continue
    }
    for (const folder of parseLibraryFolders(text)) {
      libraries.push({ path: folder.path, appIds: folder.appIds })
    }
  }
  return dedupeLibraries(
    libraries.map((library) => ({
      path: normalizeExisting(library.path),
      appIds: library.appIds,
    })),
    deps.path
  )
}

async function rankLibraries(
  libraries: readonly { path: string; appIds: readonly string[] }[],
  deps: SteamDiscoveryDeps
): Promise<{ path: string; appIds: readonly string[] }[]> {
  const withApp: { path: string; appIds: readonly string[] }[] = []
  const rest: { path: string; appIds: readonly string[] }[] = []
  for (const library of libraries) {
    const manifest = deps.path.join(library.path, "steamapps", `appmanifest_${APP_ID}.acf`)
    if (library.appIds.includes(APP_ID) || (await deps.fs.isFile(manifest))) {
      withApp.push(library)
    } else {
      rest.push(library)
    }
  }
  return [...withApp, ...rest]
}

function normalizeExisting(value: string): string {
  return value.replace(/[\\/]+$/, "") || value
}

function cs2CfgDirectory(libraryPath: string, pathApi: PathApi): string {
  return pathApi.join(libraryPath, ...CS2_CFG_SUFFIX)
}

function samePath(a: string, b: string, pathApi: PathApi): boolean {
  if (pathApi.sep === "\\") {
    return a.replaceAll("/", "\\").toLowerCase() === b.replaceAll("/", "\\").toLowerCase()
  }
  return a === b
}

function dedupeLibraries(
  libraries: readonly { path: string; appIds: readonly string[] }[],
  pathApi: PathApi
): { path: string; appIds: readonly string[] }[] {
  const unique: { path: string; appIds: readonly string[] }[] = []
  for (const library of libraries) {
    const existing = unique.find((entry) => samePath(entry.path, library.path, pathApi))
    if (existing) {
      if (existing.appIds.length === 0 && library.appIds.length > 0) {
        unique[unique.indexOf(existing)] = library
      }
      continue
    }
    unique.push(library)
  }
  return unique
}

export async function windowsSteamRootsFromRegistry(): Promise<readonly string[]> {
  const keys = [
    { key: "HKCU\\Software\\Valve\\Steam", value: "SteamPath" },
    { key: "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", value: "InstallPath" },
    { key: "HKLM\\SOFTWARE\\Valve\\Steam", value: "InstallPath" },
  ]
  const roots: string[] = []
  for (const entry of keys) {
    const found = await queryRegistryString(entry.key, entry.value)
    if (found) {
      roots.push(found)
    }
  }
  return roots
}

async function queryRegistryString(key: string, valueName: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["reg", "query", key, "/v", valueName], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) {
      return null
    }
    const match = stdout.match(new RegExp(`${valueName}\\s+REG_\\w+\\s+(.+)`, "i"))
    const value = match?.[1]?.trim()
    return value ? value.replaceAll("/", "\\") : null
  } catch {
    return null
  }
}
