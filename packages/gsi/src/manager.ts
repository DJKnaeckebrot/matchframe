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
      gsi.update(input)
    },
    getState() {
      return gsi.state
    },
    reset() {
      gsi.reset()
    },
  }
}
