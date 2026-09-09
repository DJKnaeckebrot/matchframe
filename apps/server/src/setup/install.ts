import { rename, stat, unlink, writeFile } from "node:fs/promises"
import { homedir as osHomedir } from "node:os"

import { gsiEndpointUri } from "../config/listen"
import { gsiCfgMatches, GSI_CFG_FILENAME, loadGsiCfgTemplate, renderGsiCfg } from "./gsi-cfg"
import {
  discoverCs2,
  pathApiFor,
  setupPlatform,
  type SteamDiscoveryDeps,
  windowsSteamRootsFromRegistry,
  type PathApi,
} from "./steam"
import type { GsiInstallStatus, SetupStatus } from "./types"

export type SetupIo = SteamDiscoveryDeps & {
  writeFile(path: string, contents: string): Promise<void>
  openDirectory?(path: string): Promise<boolean>
}

export function defaultSetupIo(): SetupIo {
  const platform = process.platform
  const pathApi = pathApiFor(platform)
  return {
    platform,
    homedir: homedir(),
    env: process.env,
    path: pathApi,
    fs: nodeFs(),
    writeFile: atomicWrite,
    ...(platform === "win32" ? { windowsSteamRoots: windowsSteamRootsFromRegistry } : {}),
    openDirectory: openDirectory,
  }
}

export async function readSetupStatus(io: SetupIo, uri = gsiEndpointUri()): Promise<SetupStatus> {
  const platform = setupPlatform(io.platform)
  const discovery = await discoverCs2(io)
  if (discovery.state === "unsupported") {
    return {
      platform,
      gsiUri: uri,
      canOpenFolder: false,
      cs2: {
        found: false,
        gsi: { state: "unsupported", reason: discovery.reason },
      },
    }
  }
  if (discovery.state === "cs2-not-found") {
    return {
      platform,
      gsiUri: uri,
      canOpenFolder: false,
      cs2: {
        found: false,
        gsi: { state: "cs2-not-found" },
      },
    }
  }

  const canonical = renderGsiCfg(await loadGsiCfgTemplate(), uri)
  const gsi = await inspectGsiInstall(discovery.cfgDirectory, canonical, io)
  return {
    platform,
    gsiUri: uri,
    canOpenFolder: true,
    cs2: {
      found: true,
      cfgDirectory: discovery.cfgDirectory,
      gsi,
    },
  }
}

export async function inspectGsiInstall(
  cfgDirectory: string,
  canonical: string,
  io: Pick<SetupIo, "path" | "fs">
): Promise<GsiInstallStatus> {
  if (!isCs2CfgDirectory(cfgDirectory)) {
    return { state: "cs2-not-found" }
  }
  const targetPath = io.path.join(cfgDirectory, GSI_CFG_FILENAME)
  if (!isManagedCfgPath(cfgDirectory, targetPath, io.path)) {
    return { state: "cs2-not-found" }
  }
  if (!(await io.fs.isFile(targetPath))) {
    return { state: "not-installed", targetPath }
  }
  const installed = await io.fs.readFile(targetPath)
  if (installed === null) {
    return { state: "not-installed", targetPath }
  }
  if (gsiCfgMatches(installed, canonical)) {
    return { state: "installed", path: targetPath, needsUpdate: false }
  }
  return { state: "outdated", path: targetPath, needsUpdate: true }
}

export type InstallGsiResult =
  | { ok: true; setup: SetupStatus; restartRequired: true }
  | { ok: false; setup: SetupStatus; error: "cs2-not-found" | "unsupported" | "write-failed" }

export async function installGsiCfg(io: SetupIo, uri = gsiEndpointUri()): Promise<InstallGsiResult> {
  const setup = await readSetupStatus(io, uri)
  const cfgDirectory = setup.cs2.cfgDirectory
  if (!setup.cs2.found || !cfgDirectory || setup.cs2.gsi.state === "cs2-not-found") {
    return { ok: false, setup, error: "cs2-not-found" }
  }
  if (setup.cs2.gsi.state === "unsupported") {
    return { ok: false, setup, error: "unsupported" }
  }
  if (!isCs2CfgDirectory(cfgDirectory) || !(await io.fs.isDir(cfgDirectory))) {
    return { ok: false, setup, error: "cs2-not-found" }
  }

  const targetPath = io.path.join(cfgDirectory, GSI_CFG_FILENAME)
  if (!isManagedCfgPath(cfgDirectory, targetPath, io.path)) {
    return { ok: false, setup, error: "write-failed" }
  }

  try {
    const canonical = renderGsiCfg(await loadGsiCfgTemplate(), uri)
    await io.writeFile(targetPath, canonical)
  } catch {
    return { ok: false, setup, error: "write-failed" }
  }

  const next = await readSetupStatus(io, uri)
  if (next.cs2.gsi.state !== "installed") {
    return { ok: false, setup: next, error: "write-failed" }
  }
  return { ok: true, setup: next, restartRequired: true }
}

export async function openGsiFolder(io: SetupIo): Promise<boolean> {
  const setup = await readSetupStatus(io)
  const directory = setup.cs2.cfgDirectory
  if (!directory || !setup.canOpenFolder || !isCs2CfgDirectory(directory)) {
    return false
  }
  if (!io.openDirectory) {
    return false
  }
  return io.openDirectory(directory)
}

export function isCs2CfgDirectory(directory: string): boolean {
  const normalized = directory.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()
  return normalized.endsWith("/game/csgo/cfg")
}

export function isManagedCfgPath(cfgDirectory: string, targetPath: string, pathApi: PathApi): boolean {
  if (targetPath.includes("\0") || cfgDirectory.includes("\0")) {
    return false
  }
  if (targetPath.includes("..") || cfgDirectory.includes("..")) {
    return false
  }
  const expected = pathApi.join(cfgDirectory, GSI_CFG_FILENAME)
  if (pathApi.sep === "\\") {
    return expected.replaceAll("/", "\\").toLowerCase() === targetPath.replaceAll("/", "\\").toLowerCase()
  }
  return expected === targetPath
}

function nodeFs(): SetupIo["fs"] {
  return {
    async isDir(target) {
      try {
        return (await stat(target)).isDirectory()
      } catch {
        return false
      }
    },
    async isFile(target) {
      try {
        return (await stat(target)).isFile()
      } catch {
        return false
      }
    },
    async readFile(target) {
      try {
        if (!(await stat(target)).isFile()) {
          return null
        }
        return Bun.file(target).text()
      } catch {
        return null
      }
    },
  }
}

async function atomicWrite(target: string, contents: string): Promise<void> {
  const temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, contents, "utf8")
  try {
    await rename(temp, target)
  } catch {
    await writeFile(target, contents, "utf8")
    try {
      await unlink(temp)
    } catch {
      return
    }
  }
}

async function openDirectory(directory: string): Promise<boolean> {
  try {
    const command =
      process.platform === "win32"
        ? ["explorer", directory]
        : process.platform === "linux"
          ? ["xdg-open", directory]
          : null
    if (!command) {
      return false
    }
    const proc = Bun.spawn(command, { stdout: "ignore", stderr: "ignore", stdin: "ignore" })
    proc.unref()
    return true
  } catch {
    return false
  }
}

function homedir(): string {
  return osHomedir()
}
