import { useEffect, useState } from "react"
import { resolveSponsorContent } from "@workspace/presentation"

import type { OverlaySponsorView } from "../broadcast/presentation"

export function TopRightBroadcastRegion({
  sponsors,
}: {
  sponsors: readonly OverlaySponsorView[]
}) {
  if (sponsors.length === 0) {
    return null
  }

  return (
    <div className="absolute top-0 left-full ml-2.5 flex flex-col items-start gap-4">
      <SponsorSlot views={sponsors} variant="top-right" />
    </div>
  )
}

export function SponsorSlot({
  views,
  variant,
}: {
  views: readonly OverlaySponsorView[]
  variant: "top-right" | "center"
}) {
  if (views.length === 0) {
    return null
  }
  if (variant === "center") {
    return <CenterSponsor views={views} />
  }
  return <TopRightSponsor views={views} />
}

function CenterSponsor({ views }: { views: readonly OverlaySponsorView[] }) {
  return (
    <div className="flex max-w-[420px] items-center justify-center gap-2">
      <span className="shrink-0 text-[8px] tracking-[0.2em] text-(--mf-text-muted) uppercase">
        Presented by
      </span>
      <div className="flex min-w-0 items-center gap-2">
        {views.map((view, index) => (
          <SponsorEntry
            key={`${view.name ?? ""}:${view.imageUrl ?? index}`}
            view={view}
            variant="center"
          />
        ))}
      </div>
    </div>
  )
}

function TopRightSponsor({ views }: { views: readonly OverlaySponsorView[] }) {
  return (
    <aside className="relative w-max max-w-[200px] overflow-hidden bg-(--mf-surface)/92 px-2.5 pt-2 pb-1 [font-feature-settings:'kern'] has-[[data-sponsor-lockup]:empty]:hidden">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-(--mf-accent)" aria-hidden="true" />
      <p className="text-[8px] leading-none tracking-[0.22em] text-(--mf-text)/40 uppercase">
        Presented by
      </p>
      <div data-sponsor-lockup className="mt-[3px] flex flex-col items-start gap-1">{views.map((view, index) => (
        <SponsorEntry
          key={`${view.name ?? ""}:${view.imageUrl ?? index}`}
          view={view}
          variant="top-right"
        />
      ))}</div>
    </aside>
  )
}

function SponsorEntry({
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

  const logoClass =
    variant === "center"
      ? "h-3.5 w-auto max-w-[72px] object-contain"
      : "block h-[22px] max-h-[22px] w-auto max-w-[140px] shrink-0 object-contain object-left"

  return (
    <span className="flex min-w-0 items-center gap-2">
      {content.showLogo && view.imageUrl ? (
        <img
          src={view.imageUrl}
          alt={content.showText ? "" : view.name || "Sponsor"}
          className={logoClass}
          onError={(event) => {
            event.currentTarget.style.display = "none"
            setLogoFailed(true)
          }}
        />
      ) : null}
      {content.showText && view.name ? (
        <span
          className={`min-w-0 truncate uppercase ${
            variant === "center"
              ? "text-[10px] tracking-[0.16em] text-(--mf-text)/85"
              : "text-[11px] leading-none font-medium tracking-[0.14em] text-(--mf-text)/90"
          }`}
        >
          {view.name}
        </span>
      ) : null}
    </span>
  )
}
