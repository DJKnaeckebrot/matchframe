import type {
  PlayerEquipment,
  WeaponState,
  WeaponType,
} from "@workspace/game-state"

import type { GsiWeapon } from "./schema"

type WeaponCatalogEntry = {
  id: string
  name: string
  type: WeaponType
}

const PRIMARY_TYPES = new Set<WeaponType>([
  "rifle",
  "sniper",
  "smg",
  "shotgun",
  "machinegun",
])

const GRENADE_ORDER = [
  "he",
  "flash",
  "smoke",
  "molotov",
  "incendiary",
  "decoy",
] as const

const WEAPONS: Record<string, WeaponCatalogEntry> = {
  weapon_ak47: { id: "ak47", name: "AK-47", type: "rifle" },
  weapon_m4a1: { id: "m4a4", name: "M4A4", type: "rifle" },
  weapon_m4a1_silencer: { id: "m4a1_s", name: "M4A1-S", type: "rifle" },
  weapon_famas: { id: "famas", name: "FAMAS", type: "rifle" },
  weapon_galilar: { id: "galil", name: "Galil AR", type: "rifle" },
  weapon_aug: { id: "aug", name: "AUG", type: "rifle" },
  weapon_sg556: { id: "sg553", name: "SG 553", type: "rifle" },
  weapon_awp: { id: "awp", name: "AWP", type: "sniper" },
  weapon_ssg08: { id: "ssg08", name: "SSG 08", type: "sniper" },
  weapon_g3sg1: { id: "g3sg1", name: "G3SG1", type: "sniper" },
  weapon_scar20: { id: "scar20", name: "SCAR-20", type: "sniper" },
  weapon_mp9: { id: "mp9", name: "MP9", type: "smg" },
  weapon_mp7: { id: "mp7", name: "MP7", type: "smg" },
  weapon_mp5sd: { id: "mp5sd", name: "MP5-SD", type: "smg" },
  weapon_ump45: { id: "ump45", name: "UMP-45", type: "smg" },
  weapon_p90: { id: "p90", name: "P90", type: "smg" },
  weapon_bizon: { id: "bizon", name: "PP-Bizon", type: "smg" },
  weapon_mac10: { id: "mac10", name: "MAC-10", type: "smg" },
  weapon_nova: { id: "nova", name: "Nova", type: "shotgun" },
  weapon_xm1014: { id: "xm1014", name: "XM1014", type: "shotgun" },
  weapon_mag7: { id: "mag7", name: "MAG-7", type: "shotgun" },
  weapon_sawedoff: { id: "sawedoff", name: "Sawed-Off", type: "shotgun" },
  weapon_m249: { id: "m249", name: "M249", type: "machinegun" },
  weapon_negev: { id: "negev", name: "Negev", type: "machinegun" },
  weapon_deagle: { id: "deagle", name: "Desert Eagle", type: "pistol" },
  weapon_elite: { id: "elite", name: "Dual Berettas", type: "pistol" },
  weapon_fiveseven: { id: "fiveseven", name: "Five-SeveN", type: "pistol" },
  weapon_glock: { id: "glock", name: "Glock-18", type: "pistol" },
  weapon_hkp2000: { id: "p2000", name: "P2000", type: "pistol" },
  weapon_p250: { id: "p250", name: "P250", type: "pistol" },
  weapon_usp_silencer: { id: "usp_s", name: "USP-S", type: "pistol" },
  weapon_cz75a: { id: "cz75", name: "CZ75-Auto", type: "pistol" },
  weapon_revolver: { id: "r8", name: "R8 Revolver", type: "pistol" },
  weapon_tec9: { id: "tec9", name: "Tec-9", type: "pistol" },
  weapon_knife: { id: "knife", name: "Knife", type: "knife" },
  weapon_knife_t: { id: "knife", name: "Knife", type: "knife" },
  weapon_hegrenade: { id: "he", name: "HE", type: "grenade" },
  weapon_flashbang: { id: "flash", name: "Flash", type: "grenade" },
  weapon_smokegrenade: { id: "smoke", name: "Smoke", type: "grenade" },
  weapon_molotov: { id: "molotov", name: "Molotov", type: "grenade" },
  weapon_incgrenade: { id: "incendiary", name: "Incendiary", type: "grenade" },
  weapon_decoy: { id: "decoy", name: "Decoy", type: "grenade" },
  weapon_c4: { id: "c4", name: "C4", type: "bomb" },
}

export function normalizeWeapon(weapon: GsiWeapon): WeaponState | null {
  if (!weapon.name) {
    return null
  }

  const known = WEAPONS[weapon.name]
  const type = known?.type ?? typeFromGsi(weapon.type, weapon.name)
  const id = known?.id ?? fallbackId(weapon.name, type)
  const name = type === "knife" ? "Knife" : (known?.name ?? fallbackName(id))
  const normalized: WeaponState = {
    id,
    name,
    type,
    active: weapon.state === "active",
  }
  if (typeof weapon.ammo_clip === "number") {
    normalized.ammoClip = weapon.ammo_clip
  }
  if (typeof weapon.ammo_reserve === "number") {
    normalized.ammoReserve = weapon.ammo_reserve
  }
  return normalized
}

export function equipmentFromWeapons(
  weapons: readonly WeaponState[],
  flags: { hasHelmet: boolean; hasDefuseKit: boolean; hasBomb: boolean }
): PlayerEquipment {
  const primaries = weapons.filter((weapon) => PRIMARY_TYPES.has(weapon.type))
  const secondaries = weapons.filter((weapon) => weapon.type === "pistol")
  const knives = weapons.filter((weapon) => weapon.type === "knife")
  const primary = primaries.find((weapon) => weapon.active) ?? primaries[0]
  const secondary = secondaries.find((weapon) => weapon.active) ?? secondaries[0]
  const knife = knives.find((weapon) => weapon.active) ?? knives[0]
  const activeWeapon = weapons.find((weapon) => weapon.active)
  const hasBomb = flags.hasBomb || weapons.some((weapon) => weapon.type === "bomb")

  const equipment: PlayerEquipment = {
    grenades: grenadesFromWeapons(weapons),
    hasHelmet: flags.hasHelmet,
    hasDefuseKit: flags.hasDefuseKit,
    hasBomb,
  }
  if (primary) {
    equipment.primary = primary
  }
  if (secondary) {
    equipment.secondary = secondary
  }
  if (knife) {
    equipment.knife = knife
  }
  if (activeWeapon) {
    equipment.activeWeapon = activeWeapon
  }
  return equipment
}

export function grenadesFromWeapons(weapons: readonly WeaponState[]) {
  const counts = new Map<string, number>()
  for (const weapon of weapons) {
    if (weapon.type !== "grenade") {
      continue
    }
    // ponytail: count is per-slot ammoReserve (else 1). Upgrade if Valve duplicates totals across slots.
    const add = weapon.ammoReserve && weapon.ammoReserve > 0 ? weapon.ammoReserve : 1
    counts.set(weapon.id, (counts.get(weapon.id) ?? 0) + add)
  }

  const grenades = []
  for (const id of GRENADE_ORDER) {
    const count = counts.get(id)
    if (count) {
      grenades.push({ id, count })
      counts.delete(id)
    }
  }
  for (const [id, count] of counts) {
    grenades.push({ id, count })
  }
  return grenades
}

function typeFromGsi(value: string | undefined, name: string): WeaponType {
  if (value === "Rifle") {
    return "rifle"
  }
  if (value === "SniperRifle") {
    return "sniper"
  }
  if (value === "Submachine Gun" || value === "SMG") {
    return "smg"
  }
  if (value === "Shotgun") {
    return "shotgun"
  }
  if (value === "Machine Gun") {
    return "machinegun"
  }
  if (value === "Pistol") {
    return "pistol"
  }
  if (value === "Knife" || name.startsWith("weapon_knife")) {
    return "knife"
  }
  if (value === "Grenade") {
    return "grenade"
  }
  if (value === "C4") {
    return "bomb"
  }
  return "unknown"
}

function fallbackId(name: string, type: WeaponType): string {
  if (type === "knife") {
    return "knife"
  }
  return name.startsWith("weapon_") ? name.slice("weapon_".length) : name
}

function fallbackName(id: string): string {
  return id.replace(/_/g, " ").toUpperCase()
}
