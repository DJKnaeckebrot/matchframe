import type { GameEvent, GameState, ServerMessage } from "@workspace/game-state"
import {
  defaultOverlayConfig,
  emptyPlayerPresentationConfig,
  type OverlayConfig,
  type PlayerPresentationConfig,
} from "@workspace/presentation"
import { defaultTheme } from "@workspace/theme"
import type { MatchframeTheme } from "@workspace/theme"
import { create } from "zustand"

const MAX_EVENTS = 20

export type WsStatus = "connecting" | "connected" | "disconnected"

type RealtimeStore = {
  wsStatus: WsStatus
  gameConnected: boolean
  state: GameState | null
  theme: MatchframeTheme
  presentation: PlayerPresentationConfig
  overlay: OverlayConfig
  recentEvents: GameEvent[]
  setWsStatus: (wsStatus: WsStatus) => void
  applyMessage: (message: ServerMessage) => void
}

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  wsStatus: "disconnected",
  gameConnected: false,
  state: null,
  theme: defaultTheme,
  presentation: emptyPlayerPresentationConfig,
  overlay: defaultOverlayConfig,
  recentEvents: [],
  setWsStatus: (wsStatus) => set({ wsStatus }),
  applyMessage: (message) => {
    if (message.type === "connection") {
      if (message.data.connected) {
        set({ gameConnected: true })
        return
      }
      set({ gameConnected: false, state: null })
      return
    }
    if (message.type === "snapshot") {
      set({ state: message.data, gameConnected: true })
      return
    }
    if (message.type === "theme") {
      set({ theme: message.data })
      return
    }
    if (message.type === "presentation") {
      set({ presentation: message.data })
      return
    }
    if (message.type === "overlay") {
      set({ overlay: message.data })
      return
    }
    set((current) => ({
      recentEvents: [...current.recentEvents, message.data].slice(-MAX_EVENTS),
    }))
  },
}))
