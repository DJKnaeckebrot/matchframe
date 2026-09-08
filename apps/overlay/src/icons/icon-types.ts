export type IconSize = "sm" | "md" | "lg"

export type EquipmentIconType = "helmet" | "armor" | "defuse"

export type ObjectiveIconType = "bomb" | "defuse"

/** Local bundled asset URL. Packs map Matchframe ids to these — never Valve GSI names. */
export type IconPack = {
  readonly id: string
  readonly weapons: Readonly<Record<string, string>>
  readonly utilities: Readonly<Record<string, string>>
  readonly equipment: Readonly<Record<string, string>>
  readonly objectives: Readonly<Record<string, string>>
}
