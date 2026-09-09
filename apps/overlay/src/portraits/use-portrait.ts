import { EMPTY_MARK } from "../hud/format"
import { useRealtimeStore } from "../realtime/store"
import {
  overlayDisplayName,
  overlayPortraitStack,
  type OverlayPortraitView,
} from "./resolve"

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
    return EMPTY_MARK
  }
  return overlayDisplayName(player, config)
}
