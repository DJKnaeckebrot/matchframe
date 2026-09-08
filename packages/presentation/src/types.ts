export type Side = "CT" | "T"

export type PortraitType = "custom" | "operator"

export type PortraitRef = {
  type: PortraitType
  value: string
}

export type PlayerPresentation = {
  displayName?: string
  portrait?: PortraitRef
}

export type PlayerPresentationConfig = Readonly<
  Record<string, PlayerPresentation>
>

export type OperatorPortrait = {
  id: string
  side: Side
  label: string
}

export type PortraitPlayer = {
  steamId: string
  name: string
  side: Side
}

export type PortraitSource = "custom" | "operator" | "side" | "neutral"

export type PortraitCrop = {
  fit: "contain" | "cover"
  position: "bottom" | "center"
}

export type ResolvedPortrait = {
  source: PortraitSource
  assetId: string
  crop: PortraitCrop
}

export type ResolvedPlayerPresentation = {
  displayName: string
  portrait: ResolvedPortrait
}
