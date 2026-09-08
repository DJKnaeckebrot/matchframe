import { cs2ReferencePack } from "../assets/icon-packs/cs2-reference/pack"

import type { IconPack } from "./icon-types"

/** Currently selected artwork. Swap this import to replace the pack. */
const pack: IconPack = cs2ReferencePack

const LABELS: Record<string, string> = {
  he: "HE",
  flash: "Flash",
  smoke: "Smoke",
  molotov: "Molotov",
  incendiary: "Incendiary",
  decoy: "Decoy",
  bomb: "Bomb",
  defuse: "Defuse kit",
  helmet: "Helmet",
  armor: "Armor",
}

export function resolveWeaponIcon(weaponId: string): string | undefined {
  return pack.weapons[weaponId]
}

export function resolveUtilityIcon(utilityId: string): string | undefined {
  return pack.utilities[utilityId]
}

/** Active-slot lookup: guns, then nades, then C4. Overlay ids only. */
export function resolveHudIcon(id: string): string | undefined {
  return pack.weapons[id] ?? pack.utilities[id] ?? (id === "c4" ? pack.objectives.bomb : undefined)
}

export function isCompactHudIcon(id: string): boolean {
  return id in pack.utilities || id === "c4"
}

export function resolveEquipmentIcon(type: string): string | undefined {
  return pack.equipment[type]
}

export function resolveObjectiveIcon(type: string): string | undefined {
  return pack.objectives[type]
}

export function iconLabel(id: string): string {
  return LABELS[id] ?? id.replace(/_/g, " ")
}

/** Show a numeric badge only when the player is holding more than one. */
export function utilityCountBadge(count: number): number | null {
  if (!Number.isFinite(count) || count <= 1) {
    return null
  }
  return count
}
