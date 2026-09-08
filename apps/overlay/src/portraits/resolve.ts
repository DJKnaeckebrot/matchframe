import type { PlayerState } from "@workspace/game-state"
import {
  resolveDisplayName,
  resolvePortraitCascade,
  type PlayerPresentationConfig,
  type PortraitCrop,
  type PortraitPlayer,
  type PortraitSource,
} from "@workspace/presentation"

import { getPortraitAsset } from "../assets/portraits/pack"
import { portraitInitials } from "../broadcast/presentation"

export type OverlayPortraitView = {
  source: PortraitSource | "placeholder"
  assetId?: string
  src?: string
  crop: PortraitCrop
  initials: string
  number?: number
}

const PLACEHOLDER_CROP: PortraitCrop = { fit: "contain", position: "bottom" }

export function toPortraitPlayer(
  player: Pick<PlayerState, "steamId" | "name" | "side">
): PortraitPlayer {
  return { steamId: player.steamId, name: player.name, side: player.side }
}

export function overlayDisplayName(
  player: Pick<PlayerState, "steamId" | "name">,
  config: PlayerPresentationConfig
): string {
  return resolveDisplayName(player, config)
}

export function shouldPunchPortrait(source: OverlayPortraitView["source"]): boolean {
  return source === "operator" || source === "side"
}

export function overlayPortraitStack(
  player: Pick<PlayerState, "steamId" | "name" | "side"> | null,
  config: PlayerPresentationConfig,
  number?: number
): OverlayPortraitView[] {
  const initials = portraitInitials(player?.name ?? "", number)
  const numbered = number !== undefined ? { number } : {}
  if (!player) {
    return [
      {
        source: "placeholder",
        crop: PLACEHOLDER_CROP,
        initials,
        ...numbered,
      },
    ]
  }

  return resolvePortraitCascade(toPortraitPlayer(player), config)
    .filter((entry) => entry.source !== "neutral")
    .map((resolved) => {
      const src = getPortraitAsset(resolved.assetId)
      return {
        source: resolved.source,
        assetId: resolved.assetId,
        crop: resolved.crop,
        initials,
        ...numbered,
        ...(src ? { src } : {}),
      }
    })
}

export function resolveOverlayPortrait(
  player: Pick<PlayerState, "steamId" | "name" | "side"> | null,
  config: PlayerPresentationConfig,
  number?: number
): OverlayPortraitView {
  return (
    overlayPortraitStack(player, config, number)[0] ?? {
      source: "placeholder",
      crop: PLACEHOLDER_CROP,
      initials: portraitInitials(player?.name ?? "", number),
    }
  )
}
