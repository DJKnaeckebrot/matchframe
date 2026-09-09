import { useEffect, useState } from "react"
import type { BroadcastInterstitial, GameState, Side } from "@workspace/game-state"

import { useRealtimeStore } from "../realtime/store"

export function useActiveInterstitial(): BroadcastInterstitial | null {
  const payload = useRealtimeStore((store) => store.interstitial)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!payload) {
      return
    }
    const remaining = payload.expiresAt - Date.now()
    if (remaining <= 0) {
      setNow(Date.now())
      return
    }
    const timer = setTimeout(() => setNow(Date.now()), remaining)
    return () => clearTimeout(timer)
  }, [payload])

  if (!payload || payload.expiresAt <= now) {
    return null
  }
  return payload.card
}

export function interstitialSide(
  state: GameState,
  card: BroadcastInterstitial
): Side | undefined {
  if (card.type !== "round-winner") {
    return state.players.find((player) => player.steamId === card.playerSteamId)?.side
  }
  return state.teams.find((team) => team.id === card.teamId)?.side
}

export function teamLogoUrl(
  teams: GameState["teams"],
  teamId: string,
  leftLogoUrl?: string,
  rightLogoUrl?: string
): string | undefined {
  const index = teams.findIndex((team) => team.id === teamId)
  if (index === 0) {
    return leftLogoUrl
  }
  if (index === 1) {
    return rightLogoUrl
  }
  return undefined
}
