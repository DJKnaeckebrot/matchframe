import type { ReactNode } from "react"
import type { BroadcastInterstitial, GameState, PlayerState, Side } from "@workspace/game-state"

import {
  formatWinReasonFull,
  teamBroadcastName,
  type OverlayShow,
} from "../broadcast/presentation"
import { interstitialSide, teamLogoUrl } from "../broadcast/interstitial"
import { EMPTY_MARK } from "../hud/format"
import { useOverlayPortraits, usePlayerDisplayName } from "../portraits/use-portrait"
import { PlayerPortrait } from "./PlayerPortrait"

export function BroadcastInterstitial({
  state,
  show,
}: {
  state: GameState
  show: OverlayShow
}) {
  const card = show.interstitial
  if (!card) {
    return null
  }
  const side = interstitialSide(state, card)
  const teamName = teamBroadcastName(state.teams, card.teamId, show.broadcast)
  const logoUrl = teamLogoUrl(state.teams, card.teamId, show.branding.leftLogoUrl, show.branding.rightLogoUrl)

  if (card.type === "round-winner") {
    return (
      <InterstitialShell side={side} compact>
        <RoundWinnerInterstitial
          teamName={teamName ?? EMPTY_MARK}
          logoUrl={logoUrl}
          reason={formatWinReasonFull(card.winReason)}
        />
      </InterstitialShell>
    )
  }

  const player = state.players.find((entry) => entry.steamId === card.playerSteamId)
  return (
    <InterstitialShell side={side}>
      <PlayerAchievementInterstitial
        card={card}
        player={player}
        teamName={teamName}
        side={side ?? player?.side}
      />
    </InterstitialShell>
  )
}

function InterstitialShell({
  side,
  compact,
  children,
}: {
  side?: Side
  compact?: boolean
  children: ReactNode
}) {
  const accent = side === "CT" ? "var(--mf-ct)" : side === "T" ? "var(--mf-t)" : "var(--mf-accent)"
  return (
    <aside
      className={`mf-interstitial pointer-events-none absolute top-[210px] left-1/2 z-(--mf-z-chrome) w-[380px] -translate-x-1/2 ${
        compact ? "max-w-[340px]" : ""
      }`}
      style={{ ["--mf-interstitial-accent" as string]: accent }}
    >
      {children}
    </aside>
  )
}

function RoundWinnerInterstitial({
  teamName,
  logoUrl,
  reason,
}: {
  teamName: string
  logoUrl?: string
  reason?: string
}) {
  return (
    <div className="relative overflow-hidden bg-(--mf-background)/78">
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: "var(--mf-interstitial-accent)" }}
        aria-hidden="true"
      />
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "var(--mf-interstitial-accent)" }}
        aria-hidden="true"
      />
      <div className="flex flex-col items-center px-8 py-5 pl-9">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="mb-2 h-10 w-10 object-contain"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        ) : null}
        <p className="mf-display text-center text-[28px] leading-none tracking-[0.08em] text-(--mf-text) uppercase">
          {teamName}
        </p>
        <p className="mt-2 text-[11px] tracking-[0.22em] text-(--mf-text-muted) uppercase">
          Wins the round
        </p>
        {reason ? (
          <p
            className="mt-3 text-[10px] tracking-[0.2em] uppercase"
            style={{ color: "var(--mf-interstitial-accent)" }}
          >
            {reason}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function PlayerAchievementInterstitial({
  card,
  player,
  teamName,
  side,
}: {
  card: Exclude<BroadcastInterstitial, { type: "round-winner" }>
  player?: PlayerState
  teamName?: string
  side?: Side
}) {
  const portraits = useOverlayPortraits(
    player ?? (card.playerSteamId ? { steamId: card.playerSteamId, name: "", side: side ?? "CT" } : null)
  )
  const displayName = usePlayerDisplayName(
    player ?? (card.playerSteamId ? { steamId: card.playerSteamId, name: "" } : null)
  )
  const kicker =
    card.type === "ace" ? "ACE" : card.type === "clutch" ? "CLUTCH" : "MVP"
  const detail =
    card.type === "clutch"
      ? `1v${card.opponentsAtClutchStart}`
      : card.type === "ace"
        ? `${card.roundKills} KILLS`
        : card.roundKills > 0
          ? `${card.roundKills} ${card.roundKills === 1 ? "KILL" : "KILLS"}`
          : undefined

  return (
    <div className="relative flex overflow-hidden bg-(--mf-background)/78">
      <span
        className="absolute inset-y-0 left-0 z-2 w-[3px]"
        style={{ background: "var(--mf-interstitial-accent)" }}
        aria-hidden="true"
      />
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "var(--mf-interstitial-accent)" }}
        aria-hidden="true"
      />
      <div className="relative h-[176px] w-[148px] shrink-0 overflow-hidden bg-(--mf-surface)/80">
        <PlayerPortrait portraits={portraits} className="mf-interstitial-portrait" />
      </div>
      <div className="relative -ml-3 flex min-w-0 flex-1 flex-col justify-center py-5 pr-5 pl-4">
        <p
          className="mf-display text-[42px] leading-none tracking-[0.06em] uppercase"
          style={{ color: "var(--mf-interstitial-accent)" }}
        >
          {kicker}
        </p>
        <p className="mt-2 truncate text-[18px] font-semibold tracking-[0.08em] text-(--mf-text) uppercase">
          {displayName !== EMPTY_MARK ? displayName : (player?.name ?? EMPTY_MARK)}
        </p>
        {teamName ? (
          <p className="mt-1 truncate text-[10px] tracking-[0.18em] text-(--mf-text-muted) uppercase">
            {teamName}
          </p>
        ) : null}
        {detail ? (
          <p className="mf-display mt-3 text-[20px] leading-none tracking-[0.12em] text-(--mf-text) uppercase">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}
