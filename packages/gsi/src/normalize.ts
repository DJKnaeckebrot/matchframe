import type {
  BombState,
  BombStatus,
  GameState,
  MapPhase,
  PauseState,
  PlayerState,
  RoundPhase,
  RoundState,
  RoundWinReason,
  Side,
  TeamState,
  Vector3,
} from "@workspace/game-state"
import { aliveCountsBySide } from "@workspace/game-state"

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
    value === "defusing" ||
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
  if (state === "defusing" && payload.bomb.player) {
    bomb.defuserSteamId = payload.bomb.player
  }
  const position = parsePosition(payload.bomb.position)
  if (position) {
    bomb.position = position
  }
  const countdown = plantedCountdown(payload, state)
  if (countdown !== undefined) {
    bomb.countdown = countdown
  }
  const defuseCountdown = defuseRemaining(payload, state)
  if (defuseCountdown !== undefined) {
    bomb.defuseCountdown = defuseCountdown
  }
  return bomb
}

function plantedCountdown(payload: GsiPayload, state: BombStatus): number | undefined {
  if (state !== "planted" && state !== "exploding") {
    return undefined
  }
  const fromBomb = toCountdown(payload.bomb?.countdown)
  if (fromBomb !== undefined) {
    return fromBomb
  }
  if (payload.phase_countdowns?.phase === "bomb") {
    return toCountdown(payload.phase_countdowns.phase_ends_in)
  }
  return undefined
}

function defuseRemaining(payload: GsiPayload, state: BombStatus): number | undefined {
  if (state !== "defusing") {
    return undefined
  }
  const fromBomb = toCountdown(payload.bomb?.countdown)
  if (fromBomb !== undefined) {
    return fromBomb
  }
  if (payload.phase_countdowns?.phase === "defuse") {
    return toCountdown(payload.phase_countdowns.phase_ends_in)
  }
  return undefined
}

function normalizeRound(payload: GsiPayload, players: readonly PlayerState[]): RoundState {
  const phase = asRoundPhase(payload.round?.phase)
  const round: RoundState = {
    phase,
    winTeam: asSide(payload.round?.win_team),
    alive: aliveCountsBySide(players),
  }
  const timeRemaining = roundClock(payload)
  if (timeRemaining !== undefined) {
    round.timeRemaining = timeRemaining
  }
  if (phase === "over") {
    const winReason = normalizeWinReason(payload)
    if (winReason) {
      round.winReason = winReason
    }
  }
  return round
}

function roundClock(payload: GsiPayload): number | undefined {
  const phase = payload.phase_countdowns?.phase
  if (phase !== "freezetime" && phase !== "live" && phase !== "over") {
    return undefined
  }
  return toCountdown(payload.phase_countdowns?.phase_ends_in)
}

function normalizeWinReason(payload: GsiPayload): RoundWinReason | undefined {
  const fromWins = winReasonFromRoundWins(payload)
  if (fromWins) {
    return fromWins
  }
  return winReasonFromRoundBomb(payload.round?.bomb)
}

function winReasonFromRoundWins(payload: GsiPayload): RoundWinReason | undefined {
  const wins = payload.map?.round_wins
  const round = payload.map?.round
  if (!wins || round === undefined) {
    return undefined
  }
  return asWinReason(wins[String(round + 1)]) ?? asWinReason(wins[String(round)])
}

function asWinReason(value: string | undefined): RoundWinReason | undefined {
  if (!value) {
    return undefined
  }
  if (value.includes("elimination")) {
    return "elimination"
  }
  if (value.includes("defuse")) {
    return "bomb_defused"
  }
  if (value.includes("bomb")) {
    return "bomb_exploded"
  }
  if (value.includes("time")) {
    return "time_expired"
  }
  return undefined
}

function winReasonFromRoundBomb(value: string | undefined): RoundWinReason | undefined {
  if (value === "exploded") {
    return "bomb_exploded"
  }
  if (value === "defused") {
    return "bomb_defused"
  }
  return undefined
}

function normalizePause(payload: GsiPayload): PauseState | null {
  const phase = payload.phase_countdowns?.phase
  const timeRemaining = toCountdown(payload.phase_countdowns?.phase_ends_in)
  if (phase === "paused") {
    return timeRemaining === undefined ? { kind: "paused" } : { kind: "paused", timeRemaining }
  }
  if (phase === "timeout_ct" || phase === "timeout_t") {
    const pause: PauseState = {
      kind: "timeout",
      side: phase === "timeout_ct" ? "CT" : "T",
    }
    if (timeRemaining !== undefined) {
      pause.timeRemaining = timeRemaining
    }
    return pause
  }
  return null
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
    round: normalizeRound(payload, players),
    teams: [ct, t],
    players,
    observer: {
      playerSteamId: payload.player?.steamid ?? null,
    },
    bomb,
    pause: normalizePause(payload),
  }
}
