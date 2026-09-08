import { describe, expect, test } from "bun:test"

import {
  iconLabel,
  isCompactHudIcon,
  resolveEquipmentIcon,
  resolveHudIcon,
  resolveObjectiveIcon,
  resolveUtilityIcon,
  resolveWeaponIcon,
  utilityCountBadge,
} from "./icon-registry"

describe("icon registry", () => {
  test("catalog gun ids resolve to bundled assets", () => {
    const ids = [
      "ak47",
      "m4a1_s",
      "m4a4",
      "famas",
      "galil",
      "aug",
      "sg553",
      "awp",
      "ssg08",
      "g3sg1",
      "scar20",
      "mp9",
      "mp7",
      "mp5sd",
      "ump45",
      "p90",
      "bizon",
      "mac10",
      "nova",
      "xm1014",
      "mag7",
      "sawedoff",
      "m249",
      "negev",
      "deagle",
      "elite",
      "fiveseven",
      "glock",
      "usp_s",
      "p2000",
      "p250",
      "cz75",
      "r8",
      "tec9",
      "knife",
    ]
    for (const id of ids) {
      expect(typeof resolveWeaponIcon(id)).toBe("string")
    }
  })

  test("known utility id resolves to a bundled asset", () => {
    expect(typeof resolveUtilityIcon("flash")).toBe("string")
    expect(typeof resolveUtilityIcon("he")).toBe("string")
    expect(typeof resolveUtilityIcon("smoke")).toBe("string")
  })

  test("unknown weapon uses fallback (no asset)", () => {
    expect(resolveWeaponIcon("weapon_ak47")).toBeUndefined()
    expect(resolveWeaponIcon("prototype_laser")).toBeUndefined()
  })

  test("unknown utility does not throw", () => {
    expect(resolveUtilityIcon("weapon_flashbang")).toBeUndefined()
    expect(resolveUtilityIcon("tactical_nuke")).toBeUndefined()
    expect(iconLabel("tactical_nuke")).toBe("tactical nuke")
  })

  test("equipment and objectives share bomb/defuse artwork", () => {
    expect(typeof resolveEquipmentIcon("helmet")).toBe("string")
    expect(resolveEquipmentIcon("defuse")).toBe(resolveObjectiveIcon("defuse"))
    expect(typeof resolveObjectiveIcon("bomb")).toBe("string")
  })

  test("flash count badge uses normalized count", () => {
    expect(utilityCountBadge(1)).toBeNull()
    expect(utilityCountBadge(2)).toBe(2)
    expect(utilityCountBadge(0)).toBeNull()
  })

  test("active-slot lookup finds grenades and C4", () => {
    expect(typeof resolveHudIcon("he")).toBe("string")
    expect(resolveHudIcon("he")).toBe(resolveUtilityIcon("he"))
    expect(typeof resolveHudIcon("c4")).toBe("string")
    expect(resolveHudIcon("c4")).toBe(resolveObjectiveIcon("bomb"))
    expect(isCompactHudIcon("he")).toBe(true)
    expect(isCompactHudIcon("ak47")).toBe(false)
  })
})
