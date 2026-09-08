export type Side = "CT" | "T"

export type MapPhase =
  | "warmup"
  | "live"
  | "intermission"
  | "gameover"
  | "unknown"

export type RoundPhase = "freezetime" | "live" | "over" | "unknown"

export type WeaponEquipState = "holstered" | "active" | "unknown"

export type BombPlantState =
  | "carried"
  | "dropped"
  | "planted"
  | "defused"
  | "exploding"
  | "exploded"
  | "unknown"

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
  name: string
  type: string
  state: WeaponEquipState
  ammoClip: number
  ammoReserve: number
}

export type PlayerState = {
  steamId: string
  name: string
  teamId: string
  side: Side
  alive: boolean
  health: number
  armor: number
  helmet: boolean
  money: number
  kills: number
  assists: number
  deaths: number
  weapons: readonly WeaponState[]
}

export type ObserverState = {
  steamId: string | null
}

export type BombState = {
  state: BombPlantState
  playerSteamId: string | null
  countdown: number | null
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
