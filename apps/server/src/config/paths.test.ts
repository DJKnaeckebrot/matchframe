import { describe, expect, test } from "bun:test"
import { join } from "node:path"

import { resolveRuntimePaths, type PathResolveInput } from "./paths"

function input(partial: Partial<PathResolveInput> = {}): PathResolveInput {
  return {
    env: {},
    portable: false,
    platform: "win32",
    cwd: "F:\\dev\\Matchframe\\matchframe\\apps\\server",
    execPath: "C:\\Program Files\\Matchframe\\Matchframe.exe",
    standalone: false,
    portableFlagExists: false,
    ...partial,
  }
}

describe("runtime paths", () => {
  test("MATCHFRAME_DATA_DIR wins over portable and installed defaults", () => {
    const paths = resolveRuntimePaths(
      input({
        env: { MATCHFRAME_DATA_DIR: "D:\\broadcast\\mf-data", LOCALAPPDATA: "C:\\Users\\op\\AppData\\Local" },
        portable: true,
        standalone: true,
        portableFlagExists: true,
      })
    )
    expect(paths.mode).toBe("override")
    expect(paths.dataDir).toBe("D:\\broadcast\\mf-data")
    expect(paths.logFile).toBe(join("D:\\broadcast\\mf-data", "logs", "matchframe.log"))
  })

  test("portable mode stores data beside the executable", () => {
    const exe = "E:\\Matchframe\\Matchframe.exe"
    const paths = resolveRuntimePaths(
      input({
        standalone: true,
        portable: true,
        execPath: exe,
        env: { LOCALAPPDATA: "C:\\Users\\op\\AppData\\Local" },
      })
    )
    expect(paths.mode).toBe("portable")
    expect(paths.dataDir).toBe(join("E:\\Matchframe", "data"))
    expect(paths.logFile).toBe(join("E:\\Matchframe", "logs", "matchframe.log"))
  })

  test("portable.flag next to a standalone exe selects portable mode", () => {
    const paths = resolveRuntimePaths(
      input({
        standalone: true,
        portable: false,
        portableFlagExists: true,
        execPath: "E:\\Matchframe\\Matchframe.exe",
        env: { LOCALAPPDATA: "C:\\Users\\op\\AppData\\Local" },
      })
    )
    expect(paths.mode).toBe("portable")
    expect(paths.dataDir).toBe(join("E:\\Matchframe", "data"))
  })

  test("installed Windows build uses %LOCALAPPDATA%\\Matchframe\\data", () => {
    const paths = resolveRuntimePaths(
      input({
        standalone: true,
        execPath: "C:\\Users\\op\\AppData\\Local\\Programs\\Matchframe\\Matchframe.exe",
        env: { LOCALAPPDATA: "C:\\Users\\op\\AppData\\Local" },
      })
    )
    expect(paths.mode).toBe("installed")
    expect(paths.appRoot).toBe(join("C:\\Users\\op\\AppData\\Local", "Matchframe"))
    expect(paths.dataDir).toBe(join("C:\\Users\\op\\AppData\\Local", "Matchframe", "data"))
    expect(paths.logFile).toBe(join("C:\\Users\\op\\AppData\\Local", "Matchframe", "logs", "matchframe.log"))
  })

  test("development bun run keeps data next to the working directory", () => {
    const cwd = "F:\\dev\\Matchframe\\matchframe\\apps\\server"
    const paths = resolveRuntimePaths(input({ cwd, standalone: false }))
    expect(paths.mode).toBe("development")
    expect(paths.dataDir).toBe(join(cwd, "data"))
  })
})
