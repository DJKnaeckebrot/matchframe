import { describe, expect, test } from "bun:test"
import type { PlayerState } from "@workspace/game-state"
import { SIDE_DEFAULT_OPERATOR } from "@workspace/presentation"

import { getPortraitAsset } from "../assets/portraits/pack"
import { resolveOverlayPortrait } from "./resolve"

function player(partial: Partial<PlayerState> & Pick<PlayerState, "steamId" | "side">): PlayerState {
  return {
    name: partial.name ?? partial.steamId,
    teamId: partial.teamId ?? "northwind",
    alive: true,
    health: 100,
    armor: 100,
    money: 0,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: {
      grenades: [],
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
    },
    ...partial,
  }
}

describe("portrait pack", () => {
  test("operator and fallback ids resolve to bundled assets", () => {
    for (const id of ["ct_default_01", "ct_default_02", "ct_default_03", "t_default_01", "t_default_02", "t_default_03", "neutral"]) {
      expect(typeof getPortraitAsset(id)).toBe("string")
    }
  })

  test("unknown id has no asset", () => {
    expect(getPortraitAsset("weapon_ak47")).toBeUndefined()
  })
})

describe("resolveOverlayPortrait", () => {
  test("new players render immediately from the side fallback pack", () => {
    const nova = player({ steamId: "76561198000000001", side: "CT", name: "Nova" })
    const view = resolveOverlayPortrait(nova, {}, 1)
    expect(view.source).toBe("side")
    expect(view.assetId).toBe(SIDE_DEFAULT_OPERATOR.CT)
    expect(typeof view.src).toBe("string")
    expect(view.crop).toEqual({ fit: "contain", position: "bottom" })
  })

  test("custom crop is cover/center when a custom id is configured", () => {
    const nova = player({ steamId: "76561198000000001", side: "CT", name: "Nova" })
    const view = resolveOverlayPortrait(nova, {
      [nova.steamId]: { portrait: { type: "custom", value: "nova_lan" } },
    })
    expect(view.source).toBe("custom")
    expect(view.src).toBeUndefined()
    expect(view.crop).toEqual({ fit: "cover", position: "center" })
  })
})
