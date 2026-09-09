import type { CSSProperties } from "react"
import type { PortraitCrop } from "@workspace/presentation"

export type CardAlign = "left" | "right"

/** Bust artwork is scaled past the well so padded inventory renders still read as a player. */
export const BUST_PORTRAIT_HEIGHT = "158%"
export const BUST_PORTRAIT_WIDTH = "200%"
/** Shift the bust down so heads sit below grenades instead of clipping the top edge. */
export const BUST_PORTRAIT_BOTTOM = "-22%"

export function cardPortraitLayout(align: CardAlign): {
  mirrored: boolean
  loadoutAlign: CardAlign
  imageFlip: false
} {
  return {
    mirrored: align === "right",
    loadoutAlign: align,
    imageFlip: false,
  }
}

export function cardLifeClass(empty: boolean, dead: boolean): string {
  if (empty) {
    return "mf-card opacity-35"
  }
  if (dead) {
    return "mf-card grayscale-[0.72] opacity-[0.78]"
  }
  return "mf-card"
}

export function portraitStageBox(crop: PortraitCrop): CSSProperties {
  if (crop.fit === "cover") {
    return {
      display: "block",
      position: "absolute",
      inset: 0,
      transform: "none",
    }
  }
  return {
    display: "block",
    position: "absolute",
    left: "50%",
    bottom: BUST_PORTRAIT_BOTTOM,
    width: BUST_PORTRAIT_WIDTH,
    height: BUST_PORTRAIT_HEIGHT,
    transform: "translateX(-50%)",
  }
}

export function portraitStageImage(crop: PortraitCrop): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    maxWidth: "none",
    maxHeight: "none",
    objectFit: crop.fit,
    objectPosition: crop.position === "bottom" ? "bottom center" : "center",
    transform: "none",
  }
}
