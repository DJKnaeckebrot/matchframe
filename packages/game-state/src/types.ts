export type Side = "CT" | "T"

export type MapPhase =
  | "warmup"
  | "live"
  | "intermission"
  | "gameover"
  | "unknown"

export type RoundPhase = "freezetime" | "live" | "over" | "unknown"

export type WeaponType =
  | "rifle"
  | "sniper"
  | "smg"
  | "shotgun"
  | "machinegun"
  | "pistol"
  | "knife"
  | "grenade"
  | "bomb"
  | "unknown"

export type BombStatus =
  | "carried"
  | "dropped"
  | "planted"
  | "defusing"
  | "defused"
  | "exploding"
  | "exploded"
  | "unknown"

export type RoundWinReason =
  | "elimination"
  | "bomb_exploded"
  | "bomb_defused"
  | "time_expired"

export type PauseState =
  | { kind: "paused"; timeRemaining?: number }
  | { kind: "timeout"; side: Side; timeRemaining?: number }

export type Vector3 = {
  x: number
  y: number
  z: number
}

export type RoundHistoryEntry = {
  /** 1-based display round. */
  round: number
  winner: Side
  reason?: RoundWinReason
}

export type MapState = {
  name: string
  phase: MapPhase
  /** Zero-based CS2 GSI round index. Use getDisplayRoundNumber for HUD labels. */
  round: number
  /** Completed rounds on this map, oldest first. */
  roundHistory: readonly RoundHistoryEntry[]
}

export type RoundState = {
  phase: RoundPhase
  winTeam: Side | null
  winReason?: RoundWinReason
  timeRemaining?: number
  alive: {
    ct: number
    t: number
  }
}

export type TeamState = {
  id: string
  name: string
  side: Side
  score: number
  /** Maps won in the current series. */
  seriesWins: number
}

export type WeaponState = {
  id: string
  name: string
  type: WeaponType
  active: boolean
  ammoClip?: number
  ammoReserve?: number
}

export type GrenadeState = {
  id: string
  count: number
}

/**
 * World entity, not inventory. Inventory nades stay on PlayerEquipment.
 *
 * `molotov` is also the conservative type for Valve `firebomb` / `inferno`.
 * Molotov vs incendiary is a presentation choice from owner side, not
 * weapon identity. Inferno footprint is `flames`, not a smoke-style circle.
 */
export type WorldGrenadeType =
  | "smoke"
  | "flash"
  | "he"
  | "molotov"
  | "incendiary"
  | "decoy"
  | "unknown"

export type WorldGrenadeState = {
  id: string
  type: WorldGrenadeType
  ownerSteamId?: string
  /**
   * Projectile origin. Omitted for live CS2 infernos, which send flame
   * anchors and no root position.
   */
  position?: Vector3
  velocity?: Vector3
  lifetime?: number
  effectTime?: number
  /** Inferno flame anchors in world space. Omitted when GSI sent none valid. */
  flames?: readonly Vector3[]
}

export type PlayerEquipment = {
  primary?: WeaponState
  secondary?: WeaponState
  knife?: WeaponState
  grenades: readonly GrenadeState[]
  activeWeapon?: WeaponState
  hasHelmet: boolean
  hasDefuseKit: boolean
  hasBomb: boolean
}

export type PlayerState = {
  steamId: string
  name: string
  teamId: string
  side: Side
  alive: boolean
  health: number
  armor: number
  money: number
  kills: number
  assists: number
  deaths: number
  equipment: PlayerEquipment
  /** World position. Omitted when GSI did not send a valid vector. */
  position?: Vector3
  /** World facing direction. Omitted when GSI did not send a valid vector. */
  forward?: Vector3
  /** CS2 observer keyboard slot (0 = 10). */
  observerSlot?: number
}

export type ObserverState = {
  playerSteamId: string | null
}

export type BombState = {
  state: BombStatus
  carrierSteamId?: string
  defuserSteamId?: string
  position?: Vector3
  /** Remaining plant time. Not the defuse timer. */
  countdown?: number
  /** Remaining defuse time while state is defusing. */
  defuseCountdown?: number
  /** First observed plant remaining for the current planted sequence. */
  countdownDuration?: number
  /** First observed defuse remaining for the current defuse attempt. */
  defuseDuration?: number
}

export type GameState = {
  timestamp: number
  map: MapState
  round: RoundState
  teams: readonly TeamState[]
  players: readonly PlayerState[]
  observer: ObserverState
  bomb: BombState | null
  pause: PauseState | null
  worldGrenades: readonly WorldGrenadeState[]
}
