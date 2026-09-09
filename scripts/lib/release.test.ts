import { describe, expect, test } from "bun:test"

import {
  artifactNames,
  formatSha256Sums,
  isForbiddenReleasePath,
  PORTABLE_FILENAMES,
} from "./release"

describe("release staging", () => {
  test("artifact names derive from the canonical version", () => {
    const names = artifactNames("0.1.0-alpha.1")
    expect(names.setup).toBe("Matchframe-Setup-0.1.0-alpha.1-win-x64.exe")
    expect(names.portable).toBe("Matchframe-Portable-0.1.0-alpha.1-win-x64.zip")
  })

  test("checksum lines use the GNU sha256sum two-space format", () => {
    expect(
      formatSha256Sums([
        { hash: "abc", filename: "Matchframe-Setup-0.1.0-alpha.1-win-x64.exe" },
        { hash: "def", filename: "Matchframe-Portable-0.1.0-alpha.1-win-x64.zip" },
      ])
    ).toBe(
      "abc  Matchframe-Setup-0.1.0-alpha.1-win-x64.exe\ndef  Matchframe-Portable-0.1.0-alpha.1-win-x64.zip\n"
    )
  })

  test("portable stage rejects development secrets and runtime captures", () => {
    expect(isForbiddenReleasePath("Matchframe/node_modules/hono/package.json")).toBe(true)
    expect(isForbiddenReleasePath("Matchframe/.env")).toBe(true)
    expect(isForbiddenReleasePath("Matchframe/data/gsi-capture/latest.json")).toBe(true)
    expect(isForbiddenReleasePath("Matchframe/apps/server/data/theme.json")).toBe(true)
    expect(isForbiddenReleasePath("Matchframe/Matchframe.exe")).toBe(false)
    for (const name of PORTABLE_FILENAMES) {
      expect(isForbiddenReleasePath(`Matchframe/${name}`)).toBe(false)
    }
  })
})
