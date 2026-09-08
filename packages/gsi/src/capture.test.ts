import { describe, expect, test } from "bun:test"

import { sanitizeGsiCapture } from "./capture"

describe("sanitizeGsiCapture", () => {
  test("drops auth and local steam ids, keeps radar fields", () => {
    const sanitized = sanitizeGsiCapture({
      auth: { token: "secret" },
      previously: { map: true },
      added: { bomb: true },
      provider: { timestamp: 1, steamid: "76561198000009999", name: "Counter-Strike 2" },
      player: { steamid: "76561198000009999", name: "Nova" },
      map: { name: "de_anubis" },
      allplayers: {
        "76561198000000001": { name: "Nova", position: "1, 2, 3" },
      },
      bomb: { state: "carried", player: "76561198000000001" },
      grenades: { "1": { type: "smoke" } },
    })

    expect(sanitized).not.toHaveProperty("auth")
    expect(sanitized).not.toHaveProperty("previously")
    expect(JSON.stringify(sanitized)).not.toContain("secret")
    expect(sanitized?.provider).toEqual({ timestamp: 1, name: "Counter-Strike 2" })
    expect(sanitized?.player).toEqual({ steamid: "76561198000009999", name: "Nova" })
    expect(sanitized?.map).toEqual({ name: "de_anubis" })
    expect(sanitized?.allplayers).toEqual({
      "76561198000000001": { name: "Nova", position: "1, 2, 3" },
    })
    expect(sanitized?.grenades).toEqual({ "1": { type: "smoke" } })
  })

  test("rejects non-objects", () => {
    expect(sanitizeGsiCapture(null)).toBeNull()
    expect(sanitizeGsiCapture("nope")).toBeNull()
  })
})
