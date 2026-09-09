import type { ApplyResult } from "./engine"
import type { GameEvent } from "./events"
import {
  assessAce,
  clutchIfWon,
  createRoundPerformanceTracker,
  selectMvp,
  type RoundPerformanceState,
  type RoundPerformanceTracker,
} from "./round-performance"
import { isRoundWinReason } from "./selectors"
import type { GameState, RoundWinReason, Side } from "./types"

export const INTERSTITIAL_TYPES = ["ace", "clutch", "mvp", "round-winner"] as const

export type InterstitialType = (typeof INTERSTITIAL_TYPES)[number]

type BaseInterstitial = {
  id: string
  createdAt: number
  /** Side at round end. Pinned so freeze/half/spec do not recolor the card. */
  side?: Side
}

export type RoundWinnerInterstitial = BaseInterstitial & {
  type: "round-winner"
  teamId: string
  winReason?: RoundWinReason
}

export type MvpInterstitial = BaseInterstitial & {
  type: "mvp"
  teamId: string
  playerSteamId: string
  roundKills: number
}

export type AceInterstitial = BaseInterstitial & {
  type: "ace"
  teamId: string
  playerSteamId: string
  roundKills: number
}

export type ClutchInterstitial = BaseInterstitial & {
  type: "clutch"
  teamId: string
  playerSteamId: string
  opponentsAtClutchStart: number
}

export type BroadcastInterstitial =
  | RoundWinnerInterstitial
  | MvpInterstitial
  | AceInterstitial
  | ClutchInterstitial

export type InterstitialPayload = {
  card: BroadcastInterstitial
  expiresAt: number
} | null

export const INTERSTITIAL_DURATION_MS: Record<InterstitialType, number> = {
  ace: 3500,
  clutch: 3500,
  mvp: 3000,
  "round-winner": 2500,
}

/** Player-achievement pick: ACE over CLUTCH over MVP. Never ACE+CLUTCH together. */
export const INTERSTITIAL_PRIORITY: readonly InterstitialType[] = [
  "ace",
  "clutch",
  "mvp",
]

export type InterstitialAction =
  | { type: "set"; payload: NonNullable<InterstitialPayload> }
  | { type: "clear" }
  | { type: "hold" }

export type InterstitialDirector = {
  apply(previous: GameState | null, result: ApplyResult, now: number): InterstitialAction
  peek(now: number): InterstitialPayload
}

type InterstitialSession = {
  payload: NonNullable<InterstitialPayload>
  round: number
  remaining: readonly BroadcastInterstitial[]
}

export function createInterstitialDirector(
  tracker: RoundPerformanceTracker = createRoundPerformanceTracker()
): InterstitialDirector {
  let session: InterstitialSession | null = null
  let emittedRound: number | null = null

  function expire(now: number): void {
    while (session && now >= session.payload.expiresAt) {
      const next = session.remaining[0]
      if (!next) {
        session = null
        return
      }
      session = {
        payload: {
          card: next,
          expiresAt: now + INTERSTITIAL_DURATION_MS[next.type],
        },
        round: session.round,
        remaining: session.remaining.slice(1),
      }
    }
  }

  return {
    apply(previous, result, now) {
      const prior = session
      expire(now)
      const performance = tracker.apply(previous, result.state, result.events)
      if (result.events.some((event) => event.type === "round_started")) {
        emittedRound = null
      }

      const ended = roundEnded(result.events)
      if (ended && emittedRound !== ended.round) {
        const queue = composeInterstitialSequence(performance, result, now)
        if (queue.length === 0) {
          session = null
          return prior ? { type: "clear" } : { type: "hold" }
        }
        emittedRound = ended.round
        const card = queue[0]
        if (!card) {
          session = null
          return prior ? { type: "clear" } : { type: "hold" }
        }
        const payload = {
          card,
          expiresAt: now + INTERSTITIAL_DURATION_MS[card.type],
        }
        session = { payload, round: ended.round, remaining: queue.slice(1) }
        return { type: "set", payload }
      }

      if (session && prior?.payload.card.id !== session.payload.card.id) {
        return { type: "set", payload: session.payload }
      }
      if (prior && session === null) {
        return { type: "clear" }
      }
      return { type: "hold" }
    },
    peek(now) {
      expire(now)
      return session?.payload ?? null
    },
  }
}

export function composeBroadcastInterstitial(
  performance: RoundPerformanceState,
  result: ApplyResult,
  createdAt: number
): BroadcastInterstitial | null {
  const ended = roundEnded(result.events)
  if (!ended) {
    return null
  }

  const candidates = collectCandidates(performance, result.state, ended, createdAt)
  return pickInterstitial(candidates) ?? candidates.find((card) => card.type === "round-winner") ?? null
}

export function composeInterstitialSequence(
  performance: RoundPerformanceState,
  result: ApplyResult,
  createdAt: number
): BroadcastInterstitial[] {
  const ended = roundEnded(result.events)
  if (!ended) {
    return []
  }
  return sequenceInterstitials(collectCandidates(performance, result.state, ended, createdAt))
}

/**
 * Round winner first, then at most one player achievement.
 * ACE beats CLUTCH; MVP is omitted when either is present.
 */
export function sequenceInterstitials(
  candidates: readonly BroadcastInterstitial[]
): BroadcastInterstitial[] {
  const winner = candidates.find((candidate) => candidate.type === "round-winner")
  const achievement = pickInterstitial(candidates)
  return [...(winner ? [winner] : []), ...(achievement ? [achievement] : [])]
}

export function pickInterstitial(
  candidates: readonly BroadcastInterstitial[]
): BroadcastInterstitial | null {
  for (const type of INTERSTITIAL_PRIORITY) {
    const card = candidates.find((candidate) => candidate.type === type)
    if (card) {
      return card
    }
  }
  return null
}

export function parseInterstitialPayload(value: unknown): InterstitialPayload | undefined {
  if (value === null) {
    return null
  }
  if (!isRecord(value) || !isRecord(value.card) || typeof value.expiresAt !== "number") {
    return undefined
  }
  const card = parseBroadcastInterstitial(value.card)
  return card ? { card, expiresAt: value.expiresAt } : undefined
}

export function parseBroadcastInterstitial(value: unknown): BroadcastInterstitial | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.createdAt !== "number") {
    return null
  }
  const side = parseSide(value.side)
  if (value.type === "round-winner") {
    if (typeof value.teamId !== "string") {
      return null
    }
    return {
      type: "round-winner",
      id: value.id,
      createdAt: value.createdAt,
      teamId: value.teamId,
      ...(side ? { side } : {}),
      ...(isRoundWinReason(value.winReason) ? { winReason: value.winReason } : {}),
    }
  }
  if (value.type === "mvp" || value.type === "ace") {
    if (typeof value.teamId !== "string" || typeof value.playerSteamId !== "string") {
      return null
    }
    if (typeof value.roundKills !== "number") {
      return null
    }
    return {
      type: value.type,
      id: value.id,
      createdAt: value.createdAt,
      teamId: value.teamId,
      playerSteamId: value.playerSteamId,
      roundKills: value.roundKills,
      ...(side ? { side } : {}),
    }
  }
  if (value.type === "clutch") {
    if (
      typeof value.teamId !== "string" ||
      typeof value.playerSteamId !== "string" ||
      typeof value.opponentsAtClutchStart !== "number"
    ) {
      return null
    }
    return {
      type: "clutch",
      id: value.id,
      createdAt: value.createdAt,
      teamId: value.teamId,
      playerSteamId: value.playerSteamId,
      opponentsAtClutchStart: value.opponentsAtClutchStart,
      ...(side ? { side } : {}),
    }
  }
  return null
}

function collectCandidates(
  performance: RoundPerformanceState,
  state: GameState,
  ended: Extract<GameEvent, { type: "round_ended" }>,
  createdAt: number
): BroadcastInterstitial[] {
  const cards: BroadcastInterstitial[] = []
  const ace = assessAce(performance)
  if (ace.status === "ace") {
    cards.push({
      type: "ace",
      id: interstitialId("ace", ended.round, ace.playerSteamId),
      createdAt,
      teamId: ace.teamId,
      playerSteamId: ace.playerSteamId,
      roundKills: ace.roundKills,
      ...pinnedSide(state, ace.teamId, ace.playerSteamId),
    })
  }

  if (ended.teamId) {
    const clutch = clutchIfWon(performance, ended.teamId)
    if (clutch) {
      cards.push({
        type: "clutch",
        id: interstitialId("clutch", ended.round, clutch.playerSteamId),
        createdAt,
        teamId: clutch.teamId,
        playerSteamId: clutch.playerSteamId,
        opponentsAtClutchStart: clutch.opponentsAtClutchStart,
        ...pinnedSide(state, clutch.teamId, clutch.playerSteamId),
      })
    }

    const mvp = selectMvp(performance, ended.teamId, state.players)
    if (mvp) {
      cards.push({
        type: "mvp",
        id: interstitialId("mvp", ended.round, mvp.playerSteamId),
        createdAt,
        teamId: mvp.teamId,
        playerSteamId: mvp.playerSteamId,
        roundKills: mvp.roundKills,
        ...pinnedSide(state, mvp.teamId, mvp.playerSteamId),
      })
    }

    cards.push({
      type: "round-winner",
      id: interstitialId("round-winner", ended.round, ended.teamId),
      createdAt,
      teamId: ended.teamId,
      ...(ended.winReason ? { winReason: ended.winReason } : {}),
      ...pinnedSide(state, ended.teamId),
    })
  }

  return cards
}

function roundEnded(
  events: readonly GameEvent[]
): Extract<GameEvent, { type: "round_ended" }> | undefined {
  return events.find((event) => event.type === "round_ended")
}

function interstitialId(type: InterstitialType, round: number, key: string): string {
  return `${type}:${round}:${key}`
}

function pinnedSide(
  state: GameState,
  teamId: string,
  steamId?: string
): { side: Side } | Record<string, never> {
  const side =
    state.teams.find((team) => team.id === teamId)?.side ??
    (steamId ? state.players.find((player) => player.steamId === steamId)?.side : undefined)
  return side ? { side } : {}
}

function parseSide(value: unknown): Side | undefined {
  return value === "CT" || value === "T" ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
