import type { ServerMessage } from "@workspace/game-state"
import { serializeServerMessage } from "@workspace/game-state"
import type { WSContext } from "hono/ws"

export type RealtimeHub = {
  addClient(ws: WSContext): void
  removeClient(ws: WSContext): void
  sendMessage(ws: WSContext, message: ServerMessage): void
  broadcast(message: ServerMessage): void
}

export function createRealtimeHub(): RealtimeHub {
  const clients = new Map<unknown, WSContext>()

  function clientKey(ws: WSContext): unknown {
    return ws.raw ?? ws
  }

  return {
    addClient(ws) {
      clients.set(clientKey(ws), ws)
    },
    removeClient(ws) {
      clients.delete(clientKey(ws))
    },
    sendMessage(ws, message) {
      ws.send(serializeServerMessage(message))
    },
    broadcast(message) {
      const payload = serializeServerMessage(message)
      for (const [key, ws] of clients) {
        try {
          ws.send(payload)
        } catch {
          clients.delete(key)
        }
      }
    },
  }
}
