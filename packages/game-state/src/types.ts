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
  | "defused"
  | "exploding"
  | "exploded"
  | "unknown"

export type Vector3 = {
  x: number
  y: number
  z: number
}

export type MapState = {
  name: string
  phase: MapPhase
  round: number
}

export type RoundState = {
  phase: RoundPhase
  winTeam: Side | null
}

export type TeamState = {
  id: string
  name: string
  side: Side
  score: number
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
}

export type ObserverState = {
  playerSteamId: string | null
}

export type BombState = {
  state: BombStatus
  carrierSteamId?: string
  position?: Vector3
  countdown?: number
}

export type GameState = {
  timestamp: number
  map: MapState
  round: RoundState
  teams: readonly TeamState[]
  players: readonly PlayerState[]
  observer: ObserverState
  bomb: BombState | null
}
