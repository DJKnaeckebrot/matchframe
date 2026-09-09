import type { GameState, PlayerState, WeaponState } from "@workspace/game-state"
import type { RoundDisplayKind } from "@workspace/game-state"

export const PLAYER_SLOTS = 5

/** Visible empty glyph on the HUD. Hyphen only. Never an em-dash. */
export const EMPTY_MARK = "-"

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
    return EMPTY_MARK
  }
  return stripped.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${remainder.toString().padStart(2, "0")}`
}

export function formatRemaining(seconds: number): string {
  return Math.max(0, seconds).toFixed(1)
}

export function formatRoundHeadline(
  kind: RoundDisplayKind,
  round: number,
  timeoutSide?: string
): string {
  if (kind === "freezetime") {
    return `R${round} · FREEZE`
  }
  if (kind === "live") {
    return `R${round} · LIVE`
  }
  if (kind === "bomb") {
    return "PLANTED"
  }
  if (kind === "over") {
    return `ROUND ${round}`
  }
  if (kind === "paused") {
    return "PAUSED"
  }
  if (kind === "timeout") {
    return timeoutSide ? `${timeoutSide} TIMEOUT` : "TIMEOUT"
  }
  return `R${round}`
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

export function mainWeapon(player: PlayerState): WeaponState | undefined {
  return player.equipment.primary ?? player.equipment.activeWeapon ?? player.equipment.secondary
}

export function mainWeaponLabel(player: PlayerState): string {
  const weapon = mainWeapon(player)
  return weapon ? weaponShortLabel(weapon) : ""
}

export function focusedPlayer(state: GameState): PlayerState | null {
  const steamId = state.observer.playerSteamId
  if (!steamId) {
    return null
  }
  return state.players.find((player) => player.steamId === steamId) ?? null
}

/** Keyboard slot on the HUD, 1–10. GSI 0 is key 0 / slot 10. */
export function observerSlotLabel(observerSlot: number | undefined): number | undefined {
  if (observerSlot === undefined || !Number.isFinite(observerSlot)) {
    return undefined
  }
  if (observerSlot === 0) {
    return 10
  }
  if (observerSlot < 0 || observerSlot > 10) {
    return undefined
  }
  return observerSlot
}

export function playersForTeam(
  players: readonly PlayerState[],
  teamId: string
): Array<PlayerState | null> {
  const members = players
    .filter((player) => player.teamId === teamId)
    .sort(byObserverSlot)
  const slots: Array<PlayerState | null> = members.slice(0, PLAYER_SLOTS)
  while (slots.length < PLAYER_SLOTS) {
    slots.push(null)
  }
  return slots
}

/** 1–5 in team-view order. Same value on the card and the radar blob. */
export function rosterNumber(
  players: readonly PlayerState[],
  teamId: string,
  steamId: string
): number | undefined {
  const index = playersForTeam(players, teamId).findIndex(
    (player) => player?.steamId === steamId
  )
  return index >= 0 ? index + 1 : undefined
}

function byObserverSlot(a: PlayerState, b: PlayerState): number {
  const rankA = observerSlotLabel(a.observerSlot) ?? 99
  const rankB = observerSlotLabel(b.observerSlot) ?? 99
  if (rankA !== rankB) {
    return rankA - rankB
  }
  return a.name.localeCompare(b.name)
}
