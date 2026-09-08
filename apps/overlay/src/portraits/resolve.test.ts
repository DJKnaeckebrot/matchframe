import { describe, expect, test } from "bun:test"
import type { PlayerState } from "@workspace/game-state"
import { SIDE_DEFAULT_OPERATOR } from "@workspace/presentation"

import { getPortraitAsset } from "../assets/portraits/pack"
import { BUST_PORTRAIT_BOTTOM, BUST_PORTRAIT_HEIGHT, BUST_PORTRAIT_WIDTH, cardLifeClass, cardPortraitLayout, portraitStageBox, portraitStageImage } from "./card-layout"
import { overlayPortraitStack, resolveOverlayPortrait, shouldPunchPortrait } from "./resolve"

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
  test("operator, custom, and fallback ids resolve to local server URLs", () => {
    for (const id of ["ctm_sas_variantf", "tm_phoenix_varianth", "neutral", "nova_lan"]) {
      expect(typeof getPortraitAsset(id)).toBe("string")
    }
  })

  test("unsafe ids have no asset", () => {
    expect(getPortraitAsset("../theme")).toBeUndefined()
    expect(getPortraitAsset("https://cdn.example/p.png")).toBeUndefined()
  })
})

describe("resolveOverlayPortrait", () => {
  test("player cards receive a resolved portrait with src", () => {
    const nova = player({ steamId: "76561198000000001", side: "CT", name: "Nova" })
    const view = resolveOverlayPortrait(nova, {}, 1)
    expect(view.source).toBe("side")
    expect(view.assetId).toBe(SIDE_DEFAULT_OPERATOR.CT)
    expect(view.src).toContain("/api/portraits/")
    expect(view.crop).toEqual({ fit: "contain", position: "bottom" })
  })

  test("custom image wins over operator and still has a src", () => {
    const nova = player({ steamId: "76561198000000001", side: "CT", name: "Nova" })
    const view = resolveOverlayPortrait(nova, {
      [nova.steamId]: { portrait: { type: "custom", value: "nova_lan" } },
    })
    expect(view.source).toBe("custom")
    expect(view.assetId).toBe("nova_lan")
    expect(view.src).toContain("/api/portraits/nova_lan")
    expect(view.crop).toEqual({ fit: "cover", position: "center" })
  })

  test("operator wins over automatic fallback", () => {
    const nova = player({ steamId: "76561198000000001", side: "CT", name: "Nova" })
    const view = resolveOverlayPortrait(nova, {
      [nova.steamId]: { portrait: { type: "operator", value: "ctm_fbi_variantb" } },
    })
    expect(view.source).toBe("operator")
    expect(view.assetId).toBe("ctm_fbi_variantb")
    expect(view.src).toContain("/api/portraits/ctm_fbi_variantb")
  })

  test("unknown players with no config use the side fallback", () => {
    const ghost = player({ steamId: "76561198000000999", side: "T", name: "" })
    const view = resolveOverlayPortrait(ghost, {})
    expect(view.source).toBe("side")
    expect(view.assetId).toBe(SIDE_DEFAULT_OPERATOR.T)
    expect(typeof view.src).toBe("string")
  })

  test("dead players still resolve a portrait", () => {
    const nova = player({
      steamId: "76561198000000001",
      side: "CT",
      name: "Nova",
      alive: false,
      health: 0,
    })
    expect(resolveOverlayPortrait(nova, {}).src).toContain("/api/portraits/")
    expect(cardLifeClass(false, true)).toContain("grayscale")
  })
})

describe("overlayPortraitStack", () => {
  test("custom then automatic side fallback", () => {
    const nova = player({ steamId: "76561198000000001", side: "CT", name: "Nova" })
    const stack = overlayPortraitStack(nova, {
      [nova.steamId]: { portrait: { type: "custom", value: "nova_lan" } },
    })
    expect(stack.map((view) => view.source)).toEqual(["custom", "side"])
    expect(stack[0]?.src).toContain("nova_lan")
    expect(stack[1]?.assetId).toBe(SIDE_DEFAULT_OPERATOR.CT)
  })

  test("does not punch custom photos", () => {
    expect(shouldPunchPortrait("custom")).toBe(false)
    expect(shouldPunchPortrait("operator")).toBe(true)
    expect(shouldPunchPortrait("placeholder")).toBe(false)
  })
})

describe("card layout", () => {
  test("right-side cards mirror chrome but never flip artwork", () => {
    expect(cardPortraitLayout("right")).toEqual({
      mirrored: true,
      loadoutAlign: "right",
      imageFlip: false,
    })
    expect(cardPortraitLayout("left").imageFlip).toBe(false)
  })

  test("operator staging is contain, bottom-centered, and larger than the well", () => {
    const box = portraitStageBox({ fit: "contain", position: "bottom" })
    const image = portraitStageImage({ fit: "contain", position: "bottom" })
    expect(box.left).toBe("50%")
    expect(box.bottom).toBe(BUST_PORTRAIT_BOTTOM)
    expect(Number.parseFloat(BUST_PORTRAIT_BOTTOM)).toBeLessThan(0)
    expect(Number.parseFloat(BUST_PORTRAIT_HEIGHT)).toBeGreaterThan(150)
    expect(Number.parseFloat(BUST_PORTRAIT_WIDTH)).toBeGreaterThan(180)
    expect(box.width).toBe(BUST_PORTRAIT_WIDTH)
    expect(box.height).toBe(BUST_PORTRAIT_HEIGHT)
    expect(box.transform).toBe("translateX(-50%)")
    expect(image.objectFit).toBe("contain")
    expect(image.objectPosition).toBe("bottom center")
    expect(image.transform).toBe("none")
  })

  test("custom photos keep a centered cover fill and are not flipped", () => {
    const box = portraitStageBox({ fit: "cover", position: "center" })
    const image = portraitStageImage({ fit: "cover", position: "center" })
    expect(box.inset).toBe(0)
    expect(box.transform).toBe("none")
    expect(image.objectFit).toBe("cover")
    expect(image.transform).toBe("none")
  })
})
