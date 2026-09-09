import { GSI, silentLogger } from "@counter-strike-2-gsi/server"

export type GsiStateManager = {
  update(input: unknown): void
  getState(): unknown
  reset(): void
}

/**
 * Persistent raw CS2 GSI merge. Omitted blocks stay unchanged; present
 * allplayers/grenades/weapons maps prune missing keys.
 *
 * ponytail: validatePayload is off because upstream closed enums and required
 * nested fields drop whole blocks on real partials. Matchframe Zod is the
 * GameState boundary. reset() is only for an explicit match/server lifecycle
 * action — omitted blocks, rounds, and overlay reconnects must not call it.
 *
 * New map / rematch is not a full reset. Upstream deep-merges `map.round_wins`
 * and keeps omitted grenades, so those two leak onto the next game unless we
 * drop them here. Roster, scores, and series wins stay with the payload.
 */
export function createGsiStateManager(): GsiStateManager {
  const gsi = new GSI({
    changeDetection: "minimal",
    strictValidation: false,
    emitUpdateOnNoop: false,
    validatePayload: false,
    logger: silentLogger,
  })

  return {
    update(input) {
      const previous = gsi.state
      gsi.update(input)
      pruneStaleOnNewGame(previous, input, gsi.state)
    },
    getState() {
      return gsi.state
    },
    reset() {
      gsi.reset()
    },
  }
}

function pruneStaleOnNewGame(previous: unknown, incoming: unknown, merged: unknown): void {
  if (!isRecord(merged) || !isNewGame(previous, incoming)) {
    return
  }

  const incomingRecord = isRecord(incoming) ? incoming : undefined
  const incomingMap = incomingRecord && isRecord(incomingRecord.map) ? incomingRecord.map : undefined
  const mergedMap = isRecord(merged.map) ? merged.map : undefined

  if (mergedMap) {
    if (!incomingMap || !("round_wins" in incomingMap)) {
      delete mergedMap.round_wins
    } else if (isRecord(incomingMap.round_wins)) {
      mergedMap.round_wins = { ...incomingMap.round_wins }
    }
  }

  if (!incomingRecord || !("grenades" in incomingRecord)) {
    merged.grenades = {}
  }
}

function isNewGame(previous: unknown, incoming: unknown): boolean {
  if (!isRecord(previous) || !isRecord(incoming)) {
    return false
  }
  const prevMap = isRecord(previous.map) ? previous.map : undefined
  const nextMap = isRecord(incoming.map) ? incoming.map : undefined
  if (!prevMap || !nextMap) {
    return false
  }

  const prevName = prevMap.name
  const nextName = nextMap.name
  if (typeof prevName === "string" && typeof nextName === "string" && prevName !== nextName) {
    return true
  }

  if (prevMap.phase === "gameover" && typeof nextMap.phase === "string" && nextMap.phase !== "gameover") {
    return true
  }

  const prevRound = prevMap.round
  const nextRound = nextMap.round
  return typeof prevRound === "number" && typeof nextRound === "number" && nextRound < prevRound
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
