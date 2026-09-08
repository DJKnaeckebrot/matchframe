import { NEUTRAL_PORTRAIT_ID, SIDE_DEFAULT_OPERATOR, isOperatorId } from "./operators"
import type {
  PlayerPresentationConfig,
  PortraitCrop,
  PortraitPlayer,
  ResolvedPlayerPresentation,
  ResolvedPortrait,
} from "./types"

export function portraitCrop(source: ResolvedPortrait["source"]): PortraitCrop {
  if (source === "custom") {
    return { fit: "cover", position: "center" }
  }
  return { fit: "cover", position: "bottom" }
}

export function resolveDisplayName(
  player: Pick<PortraitPlayer, "steamId" | "name">,
  config: PlayerPresentationConfig
): string {
  const override = config[player.steamId]?.displayName?.trim()
  if (override) {
    return override
  }
  const name = player.name.trim()
  return name || player.steamId
}

/**
 * custom → configured operator → current-side default → neutral.
 * Side fallback follows CT/T; logical team identity is not used.
 */
export function resolvePlayerPortrait(
  player: PortraitPlayer,
  config: PlayerPresentationConfig
): ResolvedPortrait {
  const entry = config[player.steamId]
  const portrait = entry?.portrait

  if (portrait?.type === "custom" && portrait.value) {
    return resolved("custom", portrait.value)
  }

  if (portrait?.type === "operator" && isOperatorId(portrait.value)) {
    return resolved("operator", portrait.value)
  }

  const sideDefault = SIDE_DEFAULT_OPERATOR[player.side]
  if (sideDefault) {
    return resolved("side", sideDefault)
  }

  return resolved("neutral", NEUTRAL_PORTRAIT_ID)
}

export function resolvePlayerPresentation(
  player: PortraitPlayer,
  config: PlayerPresentationConfig
): ResolvedPlayerPresentation {
  return {
    displayName: resolveDisplayName(player, config),
    portrait: resolvePlayerPortrait(player, config),
  }
}

function resolved(source: ResolvedPortrait["source"], assetId: string): ResolvedPortrait {
  return { source, assetId, crop: portraitCrop(source) }
}
