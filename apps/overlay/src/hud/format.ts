import type { GameState, PlayerState, WeaponState } from "@workspace/game-state"

export const PLAYER_SLOTS = 5

/** Canonical HUD labels. Rows and the focused panel both use these. */
const WEAPON_SHORT: Record<string, string> = {
  ak47: "AK",
  m4a1_s: "M4S",
  m4a4: "M4",
  awp: "AWP",
  famas: "FAMAS",
  galil: "GALIL",
  aug: "AUG",
  sg553: "SG",
  ssg08: "SCOUT",
  g3sg1: "G3",
  scar20: "SCAR",
  mp9: "MP9",
  mp7: "MP7",
  mp5sd: "MP5",
  ump45: "UMP",
  p90: "P90",
  bizon: "BIZON",
  mac10: "MAC",
  nova: "NOVA",
  xm1014: "XM",
  mag7: "MAG7",
  sawedoff: "SAWED",
  m249: "M249",
  negev: "NEGEV",
  deagle: "DEAG",
  elite: "DUAL",
  fiveseven: "57",
  glock: "GLOCK",
  p2000: "P2K",
  p250: "P250",
  usp_s: "USP",
  cz75: "CZ",
  r8: "R8",
  tec9: "TEC9",
  knife: "KNIFE",
  c4: "C4",
}

export function mapDisplayName(name: string): string {
  const stripped = name.replace(/^de[_-]?/i, "").replace(/_/g, " ").trim()
  if (!stripped) {
    return "—"
  }
  return stripped.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatRoundPhase(phase: string): string {
  if (phase === "freezetime") {
    return "FREEZE"
  }
  if (phase === "live") {
    return "LIVE"
  }
  if (phase === "over") {
    return "OVER"
  }
  return phase.toUpperCase()
}

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`
}

export function weaponShortLabel(weapon: WeaponState): string {
  return WEAPON_SHORT[weapon.id] ?? shortFallback(weapon.id)
}

function shortFallback(id: string): string {
  return id.replace(/_/g, "").toUpperCase().slice(0, 6)
}

export function mainWeaponLabel(player: PlayerState): string {
  const weapon =
    player.equipment.primary ??
    player.equipment.activeWeapon ??
    player.equipment.secondary
  return weapon ? weaponShortLabel(weapon) : ""
}

export function focusedPlayer(state: GameState): PlayerState | null {
  const steamId = state.observer.playerSteamId
  if (!steamId) {
    return null
  }
  return state.players.find((player) => player.steamId === steamId) ?? null
}

export function playersForTeam(
  players: readonly PlayerState[],
  teamId: string
): Array<PlayerState | null> {
  const members = players.filter((player) => player.teamId === teamId)
  const slots: Array<PlayerState | null> = members.slice(0, PLAYER_SLOTS)
  while (slots.length < PLAYER_SLOTS) {
    slots.push(null)
  }
  return slots
}
