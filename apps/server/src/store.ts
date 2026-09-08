import type { GameState } from "@workspace/game-state"

type Listener = (state: GameState) => void

let current: GameState | null = null
const listeners = new Set<Listener>()

export const gameStateStore = {
  get(): GameState | null {
    return current
  },
  set(state: GameState): void {
    current = state
    for (const listener of listeners) {
      listener(state)
    }
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
