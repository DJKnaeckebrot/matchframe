import { parseServerMessage } from "@workspace/game-state"

import { useRealtimeStore } from "./store"

const RECONNECT_MS = 2000

function realtimeUrl(): string {
  return import.meta.env.VITE_REALTIME_URL || "ws://localhost:3131/ws"
}

export function startRealtimeClient(): void {
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleReconnect(): void {
    if (reconnectTimer !== null) {
      return
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_MS)
  }

  function connect(): void {
    useRealtimeStore.getState().setWsStatus("connecting")
    const ws = new WebSocket(realtimeUrl())

    ws.onopen = () => {
      useRealtimeStore.getState().setWsStatus("connected")
    }

    ws.onmessage = (event) => {
      const message = parseServerMessage(
        typeof event.data === "string" ? event.data : null
      )
      if (message) {
        useRealtimeStore.getState().applyMessage(message)
      }
    }

    ws.onclose = () => {
      useRealtimeStore.getState().setWsStatus("disconnected")
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  connect()
}
