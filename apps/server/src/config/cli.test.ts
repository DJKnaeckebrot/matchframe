import { describe, expect, test } from "bun:test"

import { parseCli } from "./cli"

describe("cli", () => {
  test("defaults keep the browser open and installed/dev data paths", () => {
    expect(parseCli(["Matchframe.exe"])).toEqual({
      portable: false,
      openBrowser: true,
      setupGsi: false,
      help: false,
    })
  })

  test("parses portable, no-browser, setup, and help flags", () => {
    expect(parseCli(["Matchframe.exe", "--portable", "--no-browser", "--setup-gsi", "--help"])).toEqual({
      portable: true,
      openBrowser: false,
      setupGsi: true,
      help: true,
    })
  })
})
