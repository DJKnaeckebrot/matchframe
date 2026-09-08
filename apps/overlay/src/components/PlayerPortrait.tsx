import { useEffect, useRef, useState } from "react"
import type { PortraitCrop } from "@workspace/presentation"

import fallbackSilhouette from "../assets/portraits/matchframe/neutral.svg?url"
import { portraitStageBox, portraitStageImage } from "../portraits/card-layout"
import type { OverlayPortraitView } from "../portraits/resolve"

export function PlayerPortrait({
  portraits,
  className,
}: {
  portraits: readonly OverlayPortraitView[]
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const stackKey = portraits.map((view) => view.src ?? view.assetId ?? view.source).join("|")
  useEffect(() => {
    setIndex(0)
  }, [stackKey])

  const portrait = portraits[index]
  const label = portrait?.number !== undefined ? `Player ${portrait.number}` : "Player"
  const src = portrait?.src
  const crop = portrait?.crop ?? { fit: "contain", position: "bottom" as const }

  return (
    <span className={`pointer-events-none absolute inset-0 block overflow-hidden ${className ?? ""}`}>
      {src && portrait ? (
        <PortraitImage
          key={src}
          src={src}
          alt={label}
          crop={crop}
          onBroken={() => setIndex((current) => current + 1)}
        />
      ) : (
        <FallbackSilhouette crop={crop} />
      )}
    </span>
  )
}

function FallbackSilhouette({ crop }: { crop: PortraitCrop }) {
  return (
    <span style={portraitStageBox(crop)}>
      <img src={fallbackSilhouette} alt="" style={{ ...portraitStageImage(crop), opacity: 0.9 }} />
    </span>
  )
}

function PortraitImage({
  src,
  alt,
  crop,
  onBroken,
}: {
  src: string
  alt: string
  crop: PortraitCrop
  onBroken: () => void
}) {
  const onBrokenRef = useRef(onBroken)
  onBrokenRef.current = onBroken

  return (
    <span style={portraitStageBox(crop)}>
      <img
        src={src}
        alt={alt}
        style={{
          ...portraitStageImage(crop),
          filter:
            crop.fit === "contain"
              ? "drop-shadow(0 0 0.8px rgb(255 255 255 / 0.45)) drop-shadow(0 10px 18px rgb(0 0 0 / 0.4))"
              : undefined,
        }}
        onError={() => onBrokenRef.current()}
      />
    </span>
  )
}
