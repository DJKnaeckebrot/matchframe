import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { PORTABLE_FLAG_NAME } from "../product"

export const MATCHFRAME_DATA_DIR_ENV = "MATCHFRAME_DATA_DIR"

export type RuntimeMode = "override" | "portable" | "installed" | "development"

export type RuntimePaths = {
  mode: RuntimeMode
  appRoot: string
  dataDir: string
  logDir: string
  logFile: string
}

export type PathResolveInput = {
  env: NodeJS.ProcessEnv
  portable: boolean
  platform: NodeJS.Platform
  cwd: string
  execPath: string
  standalone: boolean
  portableFlagExists?: boolean
}

export function isStandaloneExecutable(): boolean {
  if (Bun.isStandaloneExecutable === true) {
    return true
  }
  const exe = process.execPath.replace(/\\/g, "/").toLowerCase()
  const base = exe.slice(exe.lastIndexOf("/") + 1)
  return base === "matchframe.exe" || base === "matchframe"
}

export function executableDir(execPath: string, standalone: boolean, cwd: string): string {
  return standalone ? dirname(execPath) : cwd
}

export function resolveRuntimePaths(input: PathResolveInput): RuntimePaths {
  const override = input.env[MATCHFRAME_DATA_DIR_ENV]?.trim()
  if (override) {
    return withLogs(override, override, "override")
  }

  const exeDir = executableDir(input.execPath, input.standalone, input.cwd)
  const portableFlag =
    input.portableFlagExists ?? existsSync(join(exeDir, PORTABLE_FLAG_NAME))
  if (input.portable || (input.standalone && portableFlag)) {
    return withLogs(exeDir, join(exeDir, "data"), "portable")
  }

  if (input.standalone) {
    const appRoot = installedAppRoot(input.platform, input.env)
    return withLogs(appRoot, join(appRoot, "data"), "installed")
  }

  return withLogs(input.cwd, join(input.cwd, "data"), "development")
}

export function installedAppRoot(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): string {
  if (platform === "win32") {
    const local = env.LOCALAPPDATA?.trim()
    if (local) {
      return join(local, "Matchframe")
    }
    return join(env.USERPROFILE?.trim() || homedir(), "AppData", "Local", "Matchframe")
  }
  const xdg = env.XDG_DATA_HOME?.trim()
  if (xdg) {
    return join(xdg, "matchframe")
  }
  return join(env.HOME?.trim() || homedir(), ".local", "share", "matchframe")
}

function withLogs(appRoot: string, dataDir: string, mode: RuntimeMode): RuntimePaths {
  const logDir = mode === "override" ? join(dataDir, "logs") : join(appRoot, "logs")
  return {
    mode,
    appRoot,
    dataDir,
    logDir,
    logFile: join(logDir, "matchframe.log"),
  }
}
