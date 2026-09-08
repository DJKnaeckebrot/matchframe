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

export function roundHistoryTrack(state: GameState): RoundHistoryTrack {
  // ponytail: WS snapshot parse is structural, not a full GameState schema
  const history = state.map.roundHistory ?? []
  const displayRound = getDisplayRoundNumber(state)
  const byRound = new Map(history.map((entry) => [entry.round, entry]))
  const lastPlayed = history.reduce((max, entry) => Math.max(max, entry.round), 0)
  const inOvertime = displayRound > REGULATION || lastPlayed > REGULATION

  if (inOvertime) {
    const latest = Math.max(displayRound, lastPlayed, REGULATION + 1)
    const period = Math.floor((latest - REGULATION - 1) / OVERTIME)
    const start = REGULATION + 1 + period * OVERTIME
    return {
      overtime: period + 1,
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
