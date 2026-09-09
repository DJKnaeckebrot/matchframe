import { useEffect, useState } from "react"
import type { BroadcastInterstitial, GameState, Side } from "@workspace/game-state"

import { useRealtimeStore } from "../realtime/store"

export type InterstitialSize = "compact" | "medium" | "emphasis"
export type InterstitialComposition = "team" | "player"
export type InterstitialEmphasis = "none" | "label" | "ratio"

export type InterstitialLayout = {
  size: InterstitialSize
  composition: InterstitialComposition
  emphasis: InterstitialEmphasis
}

export function interstitialLayout(type: BroadcastInterstitial["type"]): InterstitialLayout {
  if (type === "round-winner") {
    return { size: "compact", composition: "team", emphasis: "none" }
  }
  if (type === "mvp") {
    return { size: "medium", composition: "player", emphasis: "none" }
  }
  if (type === "ace") {
    return { size: "emphasis", composition: "player", emphasis: "label" }
  }
  return { size: "emphasis", composition: "player", emphasis: "ratio" }
}

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

  if (!payload || payload.expiresAt + 80 <= now) {
    return null
  }
  return payload.card
}

export function interstitialSide(
  state: GameState,
  card: BroadcastInterstitial
): Side | undefined {
  if (card.side === "CT" || card.side === "T") {
    return card.side
  }
  const team = state.teams.find((entry) => entry.id === card.teamId)
  if (team) {
    return team.side
  }
  if (card.type === "round-winner") {
    return undefined
  }
  return state.players.find((player) => player.steamId === card.playerSteamId)?.side
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
