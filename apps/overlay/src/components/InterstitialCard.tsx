import type { InterstitialModel } from "../broadcast/presentation"
import { EMPTY_MARK } from "../hud/format"
import { useOverlayPortraits, usePlayerDisplayName } from "../portraits/use-portrait"
import { PlayerPortrait } from "./PlayerPortrait"

export function InterstitialCard({ card }: { card: InterstitialModel }) {
  const accent = card.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const player =
    card.playerSteamId && card.side
      ? { steamId: card.playerSteamId, name: card.playerName ?? "", side: card.side }
      : null
  const portraits = useOverlayPortraits(player)
  const displayName = usePlayerDisplayName(player)

  return (
    <article className="mf-chrome-in flex w-full flex-col overflow-hidden bg-(--mf-background)/88">
      <div className="h-0.5 shrink-0" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="mf-display text-[22px] leading-none tracking-[0.12em] text-(--mf-text)">
          {card.headline}
        </span>
        {card.kicker ? (
          <span className="truncate text-[10px] tracking-[0.16em] text-(--mf-text-muted) uppercase">
            {card.kicker}
          </span>
        ) : null}
      </div>
      <div
        className="relative mx-2.5 mb-2 h-[168px] overflow-hidden"
        style={{ background: `color-mix(in srgb, ${accent} 20%, var(--mf-background))` }}
      >
        <PlayerPortrait portraits={portraits} />
      </div>
      <div
        className="flex items-baseline justify-between gap-2 px-2.5 py-1.5"
        style={{ background: `color-mix(in srgb, ${accent} 32%, var(--mf-surface))` }}
      >
        <span className="truncate text-[15px] font-semibold tracking-wide text-(--mf-text) uppercase">
          {displayName !== EMPTY_MARK ? displayName : (card.playerName ?? card.teamName ?? EMPTY_MARK)}
        </span>
        {card.statLabel && card.statValue ? (
          <span className="mf-display shrink-0 text-[20px] leading-none tabular-nums">
            <span className="mr-1 text-[11px] tracking-[0.14em] text-(--mf-text)/70">{card.statLabel}</span>
            {card.statValue}
          </span>
        ) : null}
      </div>
      {card.detail || card.teamName ? (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] tracking-[0.16em] text-(--mf-text-muted) uppercase">
          <span className="truncate">{card.teamName ?? ""}</span>
          <span>{card.detail ?? ""}</span>
        </div>
      ) : null}
    </article>
  )
}
