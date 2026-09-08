import { describe, expect, test } from "bun:test"

import { equipmentFromWeapons, grenadesFromWeapons, normalizeWeapon } from "./weapons"

describe("normalizeWeapon", () => {
  test.each([
    {
      gsi: { name: "weapon_ak47", type: "Rifle", state: "active", ammo_clip: 30, ammo_reserve: 90 },
      expected: { id: "ak47", name: "AK-47", type: "rifle", active: true, ammoClip: 30, ammoReserve: 90 },
    },
    {
      gsi: { name: "weapon_m4a1_silencer", type: "Rifle", state: "holstered", ammo_clip: 20, ammo_reserve: 80 },
      expected: { id: "m4a1_s", name: "M4A1-S", type: "rifle", active: false, ammoClip: 20, ammoReserve: 80 },
    },
    {
      gsi: { name: "weapon_awp", type: "SniperRifle", state: "active", ammo_clip: 5, ammo_reserve: 30 },
      expected: { id: "awp", name: "AWP", type: "sniper", active: true, ammoClip: 5, ammoReserve: 30 },
    },
    {
      gsi: { name: "weapon_usp_silencer", type: "Pistol", state: "holstered", ammo_clip: 12, ammo_reserve: 24 },
      expected: { id: "usp_s", name: "USP-S", type: "pistol", active: false, ammoClip: 12, ammoReserve: 24 },
    },
    {
      gsi: { name: "weapon_glock", type: "Pistol", state: "active", ammo_clip: 20, ammo_reserve: 120 },
      expected: { id: "glock", name: "Glock-18", type: "pistol", active: true, ammoClip: 20, ammoReserve: 120 },
    },
    {
      gsi: { name: "weapon_knife", type: "Knife", state: "holstered" },
      expected: { id: "knife", name: "Knife", type: "knife", active: false },
    },
    {
      gsi: { name: "weapon_c4", type: "C4", state: "holstered" },
      expected: { id: "c4", name: "C4", type: "bomb", active: false },
    },
    {
      gsi: { name: "weapon_flashbang", type: "Grenade", ammo_reserve: 2, state: "holstered" },
      expected: { id: "flash", name: "Flash", type: "grenade", active: false, ammoReserve: 2 },
    },
  ])("maps $gsi.name", ({ gsi, expected }) => {
    expect(normalizeWeapon(gsi)).toEqual(expected)
  })

  test("unknown weapons stay usable through a fallback", () => {
    expect(
      normalizeWeapon({
        name: "weapon_prototype_laser",
        type: "FutureGun",
        state: "active",
        ammo_clip: 4,
        ammo_reserve: 8,
      })
    ).toEqual({
      id: "prototype_laser",
      name: "PROTOTYPE LASER",
      type: "unknown",
      active: true,
      ammoClip: 4,
      ammoReserve: 8,
    })
  })

  test("nameless weapons are dropped", () => {
    expect(normalizeWeapon({ type: "Rifle", state: "active" })).toBeNull()
  })

  test("omits ammo when GSI does not provide it", () => {
    expect(normalizeWeapon({ name: "weapon_ak47", type: "Rifle", state: "holstered" })).toEqual({
      id: "ak47",
      name: "AK-47",
      type: "rifle",
      active: false,
    })
  })

  test("unmapped knife names collapse to knife", () => {
    expect(normalizeWeapon({ name: "weapon_bayonet", type: "Knife", state: "holstered" })).toEqual({
      id: "knife",
      name: "Knife",
      type: "knife",
      active: false,
    })
  })
})

describe("equipmentFromWeapons", () => {
  test("classifies primary, secondary, knife, and active weapon", () => {
    const ak = normalizeWeapon({
      name: "weapon_ak47",
      type: "Rifle",
      state: "active",
      ammo_clip: 18,
      ammo_reserve: 90,
    })!
    const glock = normalizeWeapon({
      name: "weapon_glock",
      type: "Pistol",
      state: "holstered",
      ammo_clip: 20,
      ammo_reserve: 120,
    })!
    const knife = normalizeWeapon({ name: "weapon_knife_t", type: "Knife", state: "holstered" })!

    const equipment = equipmentFromWeapons([knife, glock, ak], {
      hasHelmet: true,
      hasDefuseKit: false,
      hasBomb: false,
    })

    expect(equipment.primary).toEqual(ak)
    expect(equipment.secondary).toEqual(glock)
    expect(equipment.knife).toEqual(knife)
    expect(equipment.activeWeapon).toEqual(ak)
    expect(equipment.hasHelmet).toBe(true)
    expect(equipment.hasDefuseKit).toBe(false)
    expect(equipment.hasBomb).toBe(false)
  })

  test("hasBomb is true when C4 is in inventory", () => {
    const c4 = normalizeWeapon({ name: "weapon_c4", type: "C4", state: "holstered" })!
    const equipment = equipmentFromWeapons([c4], {
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
    })
    expect(equipment.hasBomb).toBe(true)
  })

  test("hasBomb is true when the bomb carrier flag is set", () => {
    const equipment = equipmentFromWeapons([], {
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: true,
    })
    expect(equipment.hasBomb).toBe(true)
  })

  test("missing weapon data yields empty slots", () => {
    const equipment = equipmentFromWeapons([], {
      hasHelmet: false,
      hasDefuseKit: true,
      hasBomb: false,
    })
    expect(equipment.primary).toBeUndefined()
    expect(equipment.secondary).toBeUndefined()
    expect(equipment.knife).toBeUndefined()
    expect(equipment.activeWeapon).toBeUndefined()
    expect(equipment.grenades).toEqual([])
    expect(equipment.hasDefuseKit).toBe(true)
  })
})

describe("grenadesFromWeapons", () => {
  test("normalizes known utility ids", () => {
    const weapons = [
      normalizeWeapon({ name: "weapon_hegrenade", type: "Grenade", state: "holstered" })!,
      normalizeWeapon({ name: "weapon_smokegrenade", type: "Grenade", state: "holstered" })!,
      normalizeWeapon({ name: "weapon_molotov", type: "Grenade", state: "holstered" })!,
      normalizeWeapon({ name: "weapon_incgrenade", type: "Grenade", state: "holstered" })!,
      normalizeWeapon({ name: "weapon_decoy", type: "Grenade", state: "holstered" })!,
    ]
    expect(grenadesFromWeapons(weapons)).toEqual([
      { id: "he", count: 1 },
      { id: "smoke", count: 1 },
      { id: "molotov", count: 1 },
      { id: "incendiary", count: 1 },
      { id: "decoy", count: 1 },
    ])
  })

  test("uses ammo_reserve for multiple flashbangs on one slot", () => {
    const flash = normalizeWeapon({
      name: "weapon_flashbang",
      type: "Grenade",
      ammo_reserve: 2,
      state: "holstered",
    })!
    expect(grenadesFromWeapons([flash])).toEqual([{ id: "flash", count: 2 }])
  })

  test("merges two flashbang slots", () => {
    const a = normalizeWeapon({ name: "weapon_flashbang", type: "Grenade", state: "holstered" })!
    const b = normalizeWeapon({ name: "weapon_flashbang", type: "Grenade", ammo_reserve: 1, state: "holstered" })!
    expect(grenadesFromWeapons([a, b])).toEqual([{ id: "flash", count: 2 }])
  })
})
