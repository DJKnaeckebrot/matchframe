import {
  overlayDisplayName,
  overlayPortraitStack,
  type OverlayPortraitView,
} from "./resolve"
import { useRealtimeStore } from "../realtime/store"

export function useOverlayPortraits(
  player: { steamId: string; name: string; side: "CT" | "T" } | null,
  number?: number
): OverlayPortraitView[] {
  const config = useRealtimeStore((store) => store.presentation)
  return overlayPortraitStack(player, config, number)
}

export function usePlayerDisplayName(player: { steamId: string; name: string } | null): string {
  const config = useRealtimeStore((store) => store.presentation)
  if (!player) {
    return "—"
  }
  return overlayDisplayName(player, config)
}
