import { describe, expect, test } from "bun:test"

import { NEUTRAL_PORTRAIT_ID, SIDE_DEFAULT_OPERATOR } from "./operators"
import {
  resolveDisplayName,
  resolvePlayerPortrait,
  resolvePlayerPresentation,
} from "./resolve"
import type { PlayerPresentationConfig, PortraitPlayer } from "./types"

const nova: PortraitPlayer = {
  steamId: "76561198000000001",
  name: "Nova",
  side: "CT",
}

const viper: PortraitPlayer = {
  steamId: "76561198000000006",
  name: "Viper",
  side: "T",
}

describe("resolvePlayerPortrait", () => {
  test("looks up presentation by Steam ID, not GSI name", () => {
    const config: PlayerPresentationConfig = {
      [nova.steamId]: { portrait: { type: "operator", value: "ctm_fbi_variantb" } },
    }
    const renamed = { ...nova, name: "N0va" }
    expect(resolvePlayerPortrait(renamed, config)).toMatchObject({
      source: "operator",
      assetId: "ctm_fbi_variantb",
    })
  })

  test("custom portrait wins over operator and side fallback", () => {
    const config: PlayerPresentationConfig = {
      [nova.steamId]: {
        portrait: { type: "custom", value: "nova_lan" },
      },
    }
    expect(resolvePlayerPortrait(nova, config)).toMatchObject({
      source: "custom",
      assetId: "nova_lan",
      crop: { fit: "cover", position: "center" },
    })
  })

  test("operator override wins over side fallback", () => {
    const config: PlayerPresentationConfig = {
      [nova.steamId]: { portrait: { type: "operator", value: "tm_phoenix_varianti" } },
    }
    expect(resolvePlayerPortrait(nova, config)).toMatchObject({
      source: "operator",
      assetId: "tm_phoenix_varianti",
      crop: { fit: "cover", position: "bottom" },
    })
  })

  test("CT fallback uses the CT default operator", () => {
    expect(resolvePlayerPortrait(nova, {})).toMatchObject({
      source: "side",
      assetId: SIDE_DEFAULT_OPERATOR.CT,
    })
  })

  test("T fallback uses the T default operator", () => {
    expect(resolvePlayerPortrait(viper, {})).toMatchObject({
      source: "side",
      assetId: SIDE_DEFAULT_OPERATOR.T,
    })
  })

  test("side-switch changes automatic fallback, not an explicit portrait", () => {
    const automatic = resolvePlayerPortrait({ ...nova, side: "T" }, {})
    expect(automatic).toMatchObject({ source: "side", assetId: SIDE_DEFAULT_OPERATOR.T })

    const configured: PlayerPresentationConfig = {
      [nova.steamId]: { portrait: { type: "operator", value: "ctm_fbi_variantb" } },
    }
    expect(resolvePlayerPortrait({ ...nova, side: "T" }, configured)).toMatchObject({
      source: "operator",
      assetId: "ctm_fbi_variantb",
    })
  })

  test("missing player config uses automatic fallback", () => {
    const config: PlayerPresentationConfig = {
      someoneElse: { portrait: { type: "operator", value: "ctm_swat_variante" } },
    }
    expect(resolvePlayerPortrait(nova, config).source).toBe("side")
  })

  test("unknown operator id falls through to the side default", () => {
    const config = {
      [nova.steamId]: { portrait: { type: "operator" as const, value: "not_in_registry" } },
    }
    expect(resolvePlayerPortrait(nova, config)).toMatchObject({
      source: "side",
      assetId: SIDE_DEFAULT_OPERATOR.CT,
    })
  })
})

describe("resolveDisplayName", () => {
  test("uses an override when present", () => {
    const config: PlayerPresentationConfig = {
      [nova.steamId]: { displayName: "NORTHWIND N" },
    }
    expect(resolveDisplayName(nova, config)).toBe("NORTHWIND N")
    expect(resolveDisplayName({ ...nova, name: "changed" }, config)).toBe("NORTHWIND N")
  })

  test("falls back to the live GSI name", () => {
    expect(resolveDisplayName(nova, {})).toBe("Nova")
  })
})

describe("resolvePlayerPresentation", () => {
  test("neutral asset is reserved for an unknown side default", () => {
    expect(NEUTRAL_PORTRAIT_ID).toBe("neutral")
    const resolved = resolvePlayerPresentation(nova, {})
    expect(resolved.displayName).toBe("Nova")
    expect(resolved.portrait.source).toBe("side")
  })
})
