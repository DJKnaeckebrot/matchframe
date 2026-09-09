import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"

import { gsiEndpointUri } from "../config/listen"
import { GSI_CFG_FILENAME, loadGsiCfgTemplate, renderGsiCfg } from "./gsi-cfg"
import { inspectGsiInstall, installGsiCfg, type SetupIo } from "./install"
import { pathApiFor } from "./steam"

async function tempSteam(options: { cfgContents?: string; extraCfg?: Record<string, string> }): Promise<{
  io: SetupIo
  cfgDir: string
}> {
  const root = await mkdtemp(path.join(tmpdir(), "matchframe-steam-"))
  const linux = process.platform !== "win32"
  const steam = linux ? path.join(root, ".local", "share", "Steam") : path.join(root, "Steam")
  const cfgDir = path.join(
    steam,
    "steamapps",
    "common",
    "Counter-Strike Global Offensive",
    "game",
    "csgo",
    "cfg"
  )
  await mkdir(cfgDir, { recursive: true })
  const vdfPath = steam.replaceAll("\\", "\\\\")
  await writeFile(
    path.join(steam, "steamapps", "libraryfolders.vdf"),
    `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${vdfPath}"\n\t\t"apps"\n\t\t{\n\t\t\t"730"\t\t"1"\n\t\t}\n\t}\n}\n`,
    "utf8"
  )
  if (options.cfgContents !== undefined) {
    await writeFile(path.join(cfgDir, GSI_CFG_FILENAME), options.cfgContents, "utf8")
  }
  for (const [name, contents] of Object.entries(options.extraCfg ?? {})) {
    await writeFile(path.join(cfgDir, name), contents, "utf8")
  }

  const io: SetupIo = {
    platform: linux ? "linux" : "win32",
    homedir: linux ? root : path.join(root, "Users"),
    env: {},
    path: pathApiFor(linux ? "linux" : "win32"),
    fs: {
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
          return await readFile(target, "utf8")
        } catch {
          return null
        }
      },
    },
    writeFile: async (target, contents) => {
      await writeFile(target, contents, "utf8")
    },
    ...(linux ? {} : { windowsSteamRoots: async () => [steam] }),
  }
  return { io, cfgDir }
}

describe("inspectGsiInstall", () => {
  test("Matchframe cfg missing", async () => {
    const { io, cfgDir } = await tempSteam({})
    const canonical = renderGsiCfg(await loadGsiCfgTemplate(), gsiEndpointUri(3131))
    expect(await inspectGsiInstall(cfgDir, canonical, io)).toEqual({
      state: "not-installed",
      targetPath: path.join(cfgDir, GSI_CFG_FILENAME),
    })
  })

  test("Matchframe cfg current", async () => {
    const canonical = renderGsiCfg(await loadGsiCfgTemplate(), gsiEndpointUri(3131))
    const { io, cfgDir } = await tempSteam({ cfgContents: canonical })
    expect(await inspectGsiInstall(cfgDir, canonical, io)).toEqual({
      state: "installed",
      path: path.join(cfgDir, GSI_CFG_FILENAME),
      needsUpdate: false,
    })
  })

  test("Matchframe cfg outdated", async () => {
    const canonical = renderGsiCfg(await loadGsiCfgTemplate(), gsiEndpointUri(3131))
    const { io, cfgDir } = await tempSteam({ cfgContents: `"Old"\n{\n}\n` })
    expect(await inspectGsiInstall(cfgDir, canonical, io)).toEqual({
      state: "outdated",
      path: path.join(cfgDir, GSI_CFG_FILENAME),
      needsUpdate: true,
    })
  })
})

describe("installGsiCfg", () => {
  test("writes only the Matchframe cfg and leaves other GSI files alone", async () => {
    const { io, cfgDir } = await tempSteam({
      extraCfg: { "gamestate_integration_other.cfg": `"Other"\n{\n}\n` },
    })
    const result = await installGsiCfg(io, gsiEndpointUri(3131))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.setup.cs2.gsi.state).toBe("installed")
    const written = await readFile(path.join(cfgDir, GSI_CFG_FILENAME), "utf8")
    expect(written).toBe(renderGsiCfg(await loadGsiCfgTemplate(), gsiEndpointUri(3131)))
    expect(await readFile(path.join(cfgDir, "gamestate_integration_other.cfg"), "utf8")).toBe(
      `"Other"\n{\n}\n`
    )
  })

  test("does not install when CS2 is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "matchframe-empty-"))
    const io: SetupIo = {
      platform: "win32",
      homedir: root,
      env: {},
      path: pathApiFor("win32"),
      fs: {
        async isDir() {
          return false
        },
        async isFile() {
          return false
        },
        async readFile() {
          return null
        },
      },
      writeFile: async () => {
        throw new Error("should not write")
      },
      windowsSteamRoots: async () => [],
    }
    const result = await installGsiCfg(io)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("cs2-not-found")
    }
  })
})
