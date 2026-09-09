import { describe, expect, test } from "bun:test"

import { PRODUCT_VERSION, windowsFileVersion } from "./product"

describe("product version", () => {
  test("runtime version matches the workspace package.json", async () => {
    const pkg = (await Bun.file(new URL("../../../package.json", import.meta.url)).json()) as {
      version: string
    }
    expect(PRODUCT_VERSION).toBe(pkg.version)
    expect(PRODUCT_VERSION.length).toBeGreaterThan(0)
  })

  test("Windows file version is four numeric components", () => {
    expect(windowsFileVersion("0.1.0-alpha.1")).toBe("0.1.0.1")
    expect(windowsFileVersion("1.2.3")).toBe("1.2.3.0")
    expect(windowsFileVersion("2.0.0-beta.12")).toBe("2.0.0.12")
  })
})
