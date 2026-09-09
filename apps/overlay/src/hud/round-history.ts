import {
  getDisplayRoundNumber,
  type GameState,
  type RoundHistoryEntry,
  type RoundWinReason,
  type Side,
} from "@workspace/game-state"

/** CS2 competitive regulation. Overlay-only; GameState stays format-agnostic. */
const REGULATION = 24
const REGULATION_HALF = 12
const OVERTIME = 6
const OVERTIME_HALF = 3

export type RoundHistorySlot = {
  round: number
  winner?: Side
  reason?: RoundWinReason
  current: boolean
}

export type RoundHistoryTrack = {
  overtime: number | null
  halves: readonly [readonly RoundHistorySlot[], readonly RoundHistorySlot[]]
  labels: readonly number[]
}

/** 1-based overtime period, or null during regulation. */
export function overtimePeriod(state: GameState): number | null {
  // ponytail: WS snapshot parse is structural, not a full GameState schema
  const history = state.map.roundHistory ?? []
  const displayRound = getDisplayRoundNumber(state)
  const lastPlayed = history.reduce((max, entry) => Math.max(max, entry.round), 0)
  if (displayRound <= REGULATION && lastPlayed <= REGULATION) {
    return null
  }
  const latest = Math.max(displayRound, lastPlayed, REGULATION + 1)
  return Math.floor((latest - REGULATION - 1) / OVERTIME) + 1
}

export function roundHistoryTrack(state: GameState): RoundHistoryTrack {
  const history = state.map.roundHistory ?? []
  const displayRound = getDisplayRoundNumber(state)
  const byRound = new Map(history.map((entry) => [entry.round, entry]))
  const period = overtimePeriod(state)

  if (period) {
    const start = REGULATION + 1 + (period - 1) * OVERTIME
    return {
      overtime: period,
      halves: [
        slots(byRound, displayRound, start, OVERTIME_HALF),
        slots(byRound, displayRound, start + OVERTIME_HALF, OVERTIME_HALF),
      ],
      labels: [start + OVERTIME_HALF - 1, start + OVERTIME - 1],
    }
  }

  return {
    overtime: null,
    halves: [
      slots(byRound, displayRound, 1, REGULATION_HALF),
      slots(byRound, displayRound, REGULATION_HALF + 1, REGULATION_HALF),
    ],
    labels: [6, 12, 18, 24],
  }
}

function slots(
  byRound: ReadonlyMap<number, RoundHistoryEntry>,
  displayRound: number,
  start: number,
  count: number
): RoundHistorySlot[] {
  return Array.from({ length: count }, (_, index) => {
    const round = start + index
    const entry = byRound.get(round)
    const slot: RoundHistorySlot = { round, current: round === displayRound }
    if (entry) {
      slot.winner = entry.winner
      if (entry.reason) {
        slot.reason = entry.reason
      }
    }
    return slot
  })
}
