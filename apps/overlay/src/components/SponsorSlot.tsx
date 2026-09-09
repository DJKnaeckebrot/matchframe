import { useEffect, useState } from "react"
import { resolveSponsorContent } from "@workspace/presentation"

import type { OverlaySponsorView } from "../broadcast/presentation"

export function SponsorSlot({
  view,
  variant,
}: {
  view: OverlaySponsorView
  variant: "top-right" | "center"
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setLogoFailed(false)
  }, [view.imageUrl])
  const hasLogo = view.showLogo && Boolean(view.imageUrl) && !logoFailed
  const content = resolveSponsorContent(view.displayMode, {
    name: view.name,
    hasLogo,
  })
  if (!content) {
    return null
  }

  const mark = (
    <SponsorMark
      name={view.name}
      imageUrl={view.imageUrl}
      showLogo={content.showLogo}
      showText={content.showText}
      variant={variant}
      onLogoError={() => setLogoFailed(true)}
    />
  )

  if (variant === "center") {
    return (
      <div className="flex max-w-[220px] items-center justify-center gap-1.5">
        <span className="text-[8px] tracking-[0.2em] text-(--mf-text-muted) uppercase">
          Presented by
        </span>
        {mark}
      </div>
    )
  }

  return (
    <aside className="relative bg-(--mf-surface)/92 px-2.5 py-1.5">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-(--mf-accent)" aria-hidden="true" />
      <span className="block text-[8px] tracking-[0.2em] text-(--mf-text-muted) uppercase">
        Presented by
      </span>
      {mark}
    </aside>
  )
}

function SponsorMark({
  name,
  imageUrl,
  showLogo,
  showText,
  variant,
  onLogoError,
}: {
  name?: string
  imageUrl?: string
  showLogo: boolean
  showText: boolean
  variant: "top-right" | "center"
  onLogoError: () => void
}) {
  const logoClass =
    variant === "center"
      ? "h-3.5 max-w-[72px] object-contain"
      : "h-7 max-w-[120px] object-contain"

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {showLogo && imageUrl ? (
        <img
          src={imageUrl}
          alt={showText ? "" : name || "Sponsor"}
          className={logoClass}
          onError={(event) => {
            event.currentTarget.style.display = "none"
            onLogoError()
          }}
        />
      ) : null}
      {showText && name ? (
        <span
          className={`truncate tracking-[0.16em] text-(--mf-text)/85 uppercase ${
            variant === "center" ? "text-[10px]" : "text-[12px] font-semibold"
          }`}
        >
          {name}
        </span>
      ) : null}
    </span>
  )
}
