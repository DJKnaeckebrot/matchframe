import type {
  BombState,
  BombStatus,
  GameState,
  MapPhase,
  PlayerState,
  RoundPhase,
  Side,
  TeamState,
  Vector3,
} from "@workspace/game-state"

import type { GsiPayload, GsiPlayer, GsiTeam } from "./schema"
import { equipmentFromWeapons, normalizeWeapon } from "./weapons"

function asSide(value: string | undefined): Side | null {
  if (value === "CT" || value === "T") {
    return value
  }
  return null
}

function asMapPhase(value: string | undefined): MapPhase {
  if (
    value === "warmup" ||
    value === "live" ||
    value === "intermission" ||
    value === "gameover"
  ) {
    return value
  }
  return "unknown"
}

function asRoundPhase(value: string | undefined): RoundPhase {
  if (value === "freezetime" || value === "live" || value === "over") {
    return value
  }
  return "unknown"
}

function asBombState(value: string | undefined): BombStatus {
  if (
    value === "carried" ||
    value === "dropped" ||
    value === "planted" ||
    value === "defused" ||
    value === "exploding" ||
    value === "exploded"
  ) {
    return value
  }
  return "unknown"
}

function toCountdown(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function parsePosition(value: string | undefined): Vector3 | undefined {
  if (!value) {
    return undefined
  }
  const parts = value.split(",").map((part) => Number(part.trim()))
  const [x, y, z] = parts
  if (
    x === undefined ||
    y === undefined ||
    z === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return undefined
  }
  return { x, y, z }
}

// ponytail: ids are name slugs (else side slots). Persist identity across
// halftime in the state engine.
function teamIdFromName(name: string | undefined, side: Side): string {
  const slug = name
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (slug) {
    return slug
  }
  return side === "CT" ? "ct" : "t"
}

function normalizeTeam(team: GsiTeam | undefined, side: Side): TeamState {
  const name = team?.name?.trim() || side
  return {
    id: teamIdFromName(team?.name, side),
    name,
    side,
    score: team?.score ?? 0,
  }
}

function normalizePlayer(
  steamId: string,
  player: GsiPlayer,
  teamIdBySide: Record<Side, string>,
  bombCarrierSteamId: string | undefined
): PlayerState | null {
  const side = asSide(player.team)
  if (!side) {
    return null
  }

  const health = player.state?.health ?? 0
  const weapons = []
  if (player.weapons) {
    for (const weapon of Object.values(player.weapons)) {
      const normalized = normalizeWeapon(weapon)
      if (normalized) {
        weapons.push(normalized)
      }
    }
  }

  return {
    steamId,
    name: player.name ?? "",
    teamId: teamIdBySide[side],
    side,
    alive: health > 0,
    health,
    armor: player.state?.armor ?? 0,
    money: player.state?.money ?? 0,
    kills: player.match_stats?.kills ?? 0,
    assists: player.match_stats?.assists ?? 0,
    deaths: player.match_stats?.deaths ?? 0,
    equipment: equipmentFromWeapons(weapons, {
      hasHelmet: player.state?.helmet ?? false,
      hasDefuseKit: player.state?.defusekit === true,
      hasBomb: bombCarrierSteamId === steamId,
    }),
  }
}

function normalizeBomb(payload: GsiPayload): BombState | null {
  if (!payload.bomb) {
    return null
  }

  const state = asBombState(payload.bomb.state)
  const bomb: BombState = { state }
  if (state === "carried" && payload.bomb.player) {
    bomb.carrierSteamId = payload.bomb.player
  }
  const position = parsePosition(payload.bomb.position)
  if (position) {
    bomb.position = position
  }
  const countdown = toCountdown(payload.bomb.countdown)
  if (countdown !== undefined) {
    bomb.countdown = countdown
  }
  return bomb
}

export function normalizeGsiPayload(payload: GsiPayload): GameState {
  const ct = normalizeTeam(payload.map?.team_ct, "CT")
  const t = normalizeTeam(payload.map?.team_t, "T")
  const teamIdBySide: Record<Side, string> = { CT: ct.id, T: t.id }
  const bomb = normalizeBomb(payload)
  const bombCarrierSteamId =
    bomb?.state === "carried" ? bomb.carrierSteamId : undefined

  const players: PlayerState[] = []
  if (payload.allplayers) {
    for (const [steamId, player] of Object.entries(payload.allplayers)) {
      const normalized = normalizePlayer(
        steamId,
        player,
        teamIdBySide,
        bombCarrierSteamId
      )
      if (normalized) {
        players.push(normalized)
      }
    }
  }

  return {
    timestamp: payload.provider?.timestamp ?? 0,
    map: {
      name: payload.map?.name ?? "",
      phase: asMapPhase(payload.map?.phase),
      round: payload.map?.round ?? 0,
    },
    round: {
      phase: asRoundPhase(payload.round?.phase),
      winTeam: asSide(payload.round?.win_team),
    },
    teams: [ct, t],
    players,
    observer: {
      playerSteamId: payload.player?.steamid ?? null,
    },
    bomb,
  }
}
