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
  // Operator / side / neutral are character artwork, not photos.
  return { fit: "contain", position: "bottom" }
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
 * Duplicate asset ids (operator that is also the side default) appear once.
 */
export function resolvePortraitCascade(
  player: PortraitPlayer,
  config: PlayerPresentationConfig
): ResolvedPortrait[] {
  const entry = config[player.steamId]
  const portrait = entry?.portrait
  const out: ResolvedPortrait[] = []
  const seen = new Set<string>()

  const push = (source: ResolvedPortrait["source"], assetId: string): void => {
    if (seen.has(assetId)) {
      return
    }
    seen.add(assetId)
    out.push(resolved(source, assetId))
  }

  if (portrait?.type === "custom" && portrait.value) {
    push("custom", portrait.value)
  } else if (portrait?.type === "operator" && isOperatorId(portrait.value)) {
    push("operator", portrait.value)
  }

  const sideDefault = SIDE_DEFAULT_OPERATOR[player.side]
  if (sideDefault) {
    push("side", sideDefault)
  }
  push("neutral", NEUTRAL_PORTRAIT_ID)
  return out
}

export function resolvePlayerPortrait(
  player: PortraitPlayer,
  config: PlayerPresentationConfig
): ResolvedPortrait {
  return (
    resolvePortraitCascade(player, config)[0] ?? resolved("neutral", NEUTRAL_PORTRAIT_ID)
  )
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
