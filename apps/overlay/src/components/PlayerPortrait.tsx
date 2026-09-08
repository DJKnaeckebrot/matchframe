import { useEffect, useRef, useState } from "react"

import type { OverlayPortraitView } from "../portraits/resolve"
import { punchStudioBlack } from "../portraits/key-backdrop"

const keyedUrls = new Map<string, Promise<string>>()

export function PlayerPortrait({
  portrait,
  accent,
  className,
}: {
  portrait: OverlayPortraitView
  accent: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    setBroken(false)
  }, [portrait.src])

  const label = portrait.number !== undefined ? `Player ${portrait.number}` : "Player"
  const showImage = Boolean(portrait.src) && !broken

  return (
    <span className={`pointer-events-none relative block overflow-hidden ${className ?? "h-full w-full"}`}>
      {showImage && portrait.src ? (
        <KeyedAgentImage
          src={portrait.src}
          alt={label}
          fit={portrait.crop.fit}
          position={portrait.crop.position}
          onBroken={() => setBroken(true)}
        />
      ) : (
        <span
          className="mf-display flex h-full w-full items-center justify-center text-[22px] font-semibold text-(--mf-text)/70"
          style={{ background: `color-mix(in srgb, ${accent} 18%, var(--mf-background))` }}
          aria-hidden
        >
          {portrait.initials}
        </span>
      )}
    </span>
  )
}

function KeyedAgentImage({
  src,
  alt,
  fit,
  position,
  onBroken,
}: {
  src: string
  alt: string
  fit: "contain" | "cover"
  position: "bottom" | "center"
  onBroken: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const onBrokenRef = useRef(onBroken)
  onBrokenRef.current = onBroken

  useEffect(() => {
    let cancelled = false
    keyPortraitSrc(src)
      .then((keyed) => {
        if (!cancelled) {
          setUrl(keyed)
        }
      })
      .catch(() => {
        if (!cancelled) {
          onBrokenRef.current()
        }
      })
    return () => {
      cancelled = true
    }
  }, [src])

  if (!url) {
    return null
  }

  return (
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 h-full w-full max-h-none max-w-none"
      style={{
        objectFit: fit,
        objectPosition: position === "bottom" ? "bottom center" : "center",
        filter:
          "drop-shadow(0 0 0.7px rgb(255 255 255 / 0.4)) drop-shadow(0 10px 18px rgb(0 0 0 / 0.45))",
      }}
    />
  )
}

function keyPortraitSrc(src: string): Promise<string> {
  const cached = keyedUrls.get(src)
  if (cached) {
    return cached
  }
  const pending = punchPortraitUrl(src)
  keyedUrls.set(src, pending)
  pending.catch(() => {
    keyedUrls.delete(src)
  })
  return pending
}

async function punchPortraitUrl(src: string): Promise<string> {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`portrait ${response.status}`)
  }
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) {
    bitmap.close()
    throw new Error("no 2d context")
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  punchStudioBlack(frame)
  ctx.putImageData(frame, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) {
        resolve(out)
        return
      }
      reject(new Error("encode failed"))
    }, "image/png")
  })
  return URL.createObjectURL(blob)
}
