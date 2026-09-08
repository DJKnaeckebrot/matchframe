import { describe, expect, test } from "bun:test"

import {
  emptyPlayerPresentationConfig,
  localAssetIdSchema,
  playerPresentationConfigSchema,
  playerPresentationSchema,
  portraitRefSchema,
  steamIdSchema,
} from "./schema"

describe("steamIdSchema", () => {
  test("accepts fixture and SteamID64 keys", () => {
    expect(steamIdSchema.parse("76561198000000001")).toBe("76561198000000001")
    expect(steamIdSchema.parse("a")).toBe("a")
  })

  test("rejects empty and path-like keys", () => {
    expect(steamIdSchema.safeParse("").success).toBe(false)
    expect(steamIdSchema.safeParse("../etc").success).toBe(false)
    expect(steamIdSchema.safeParse("http://evil").success).toBe(false)
  })
})

describe("portraitRefSchema", () => {
  test("accepts a known operator", () => {
    expect(portraitRefSchema.parse({ type: "operator", value: "ct_default_01" })).toEqual({
      type: "operator",
      value: "ct_default_01",
    })
  })

  test("rejects an unknown operator id", () => {
    expect(portraitRefSchema.safeParse({ type: "operator", value: "ct_sas" }).success).toBe(false)
  })

  test("accepts a local custom id and rejects URLs", () => {
    expect(portraitRefSchema.parse({ type: "custom", value: "nova_lan" })).toEqual({
      type: "custom",
      value: "nova_lan",
    })
    expect(portraitRefSchema.safeParse({ type: "custom", value: "https://cdn.example/p.png" }).success).toBe(
      false
    )
    expect(localAssetIdSchema.safeParse("/tmp/face.png").success).toBe(false)
  })
})

describe("playerPresentationConfigSchema", () => {
  test("accepts an empty config", () => {
    expect(playerPresentationConfigSchema.parse({})).toEqual(emptyPlayerPresentationConfig)
  })

  test("accepts a steam-keyed map", () => {
    const parsed = playerPresentationConfigSchema.parse({
      "76561198000000000": {
        displayName: "Nova",
        portrait: { type: "operator", value: "ct_default_01" },
      },
    })
    expect(parsed["76561198000000000"]?.displayName).toBe("Nova")
  })

  test("rejects malformed entries", () => {
    expect(playerPresentationConfigSchema.safeParse({ x: { displayName: 1 } }).success).toBe(false)
    expect(
      playerPresentationConfigSchema.safeParse({
        a: { portrait: { type: "operator", value: "missing" } },
      }).success
    ).toBe(false)
    expect(playerPresentationSchema.safeParse({ extra: true }).success).toBe(false)
  })
})
