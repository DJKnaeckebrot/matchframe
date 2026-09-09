import type { ReactNode } from "react"
import type { BroadcastInterstitial, GameState, PlayerState, Side } from "@workspace/game-state"

import {
  formatWinReasonFull,
  teamBroadcastName,
  type OverlayShow,
} from "../broadcast/presentation"
import {
  interstitialLayout,
  interstitialSide,
  teamLogoUrl,
  type InterstitialSize,
} from "../broadcast/interstitial"
import { EMPTY_MARK } from "../hud/format"
import { useOverlayPortraits, usePlayerDisplayName } from "../portraits/use-portrait"
import { PlayerPortrait } from "./PlayerPortrait"

const SHELL_WIDTH: Record<InterstitialSize, string> = {
  compact: "w-[300px]",
  medium: "w-[328px]",
  emphasis: "w-[360px]",
}

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
  const layout = interstitialLayout(card.type)

  if (card.type === "round-winner") {
    return (
      <InterstitialShell
        key={card.id}
        type={card.type}
        size={layout.size}
        side={side}
        accent="subtle"
      >
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
    <InterstitialShell
      key={card.id}
      type={card.type}
      size={layout.size}
      side={side ?? player?.side}
      accent={layout.emphasis === "label" ? "strong" : "subtle"}
    >
      <PlayerAchievementInterstitial
        card={card}
        player={player}
        teamName={teamName}
        side={side ?? player?.side}
        emphasis={layout.emphasis}
      />
    </InterstitialShell>
  )
}

function InterstitialShell({
  type,
  size,
  side,
  accent,
  children,
}: {
  type: BroadcastInterstitial["type"]
  size: InterstitialSize
  side?: Side
  accent: "subtle" | "strong"
  children: ReactNode
}) {
  const color = side === "CT" ? "var(--mf-ct)" : side === "T" ? "var(--mf-t)" : "var(--mf-accent)"
  return (
    <aside
      className="pointer-events-none absolute inset-x-0 top-[188px] bottom-[228px] z-(--mf-z-chrome) flex items-center justify-center"
      style={{ ["--mf-interstitial-accent" as string]: color }}
      data-interstitial-type={type}
      data-interstitial-size={size}
    >
      <div
        className={`mf-interstitial relative overflow-hidden bg-(--mf-background)/82 shadow-[inset_0_0_0_1px_rgb(232_236_240_/_0.12)] ${SHELL_WIDTH[size]}`}
      >
        <span
          className={accent === "strong" ? "absolute inset-y-0 left-0 w-1" : "absolute inset-y-0 left-0 w-[3px]"}
          style={{ background: "var(--mf-interstitial-accent)" }}
          aria-hidden="true"
        />
        <span
          className={accent === "strong" ? "absolute inset-x-0 top-0 h-0.5" : "absolute inset-x-0 top-0 h-px"}
          style={{ background: "var(--mf-interstitial-accent)" }}
          aria-hidden="true"
        />
        {children}
      </div>
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
    <div className="flex flex-col items-center px-7 py-5 pl-9">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="mb-3 h-[68px] w-[68px] object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      ) : null}
      <p className="mf-display text-center text-[34px] leading-none tracking-[0.06em] text-(--mf-text) uppercase">
        {teamName}
      </p>
      <p className="mt-2 text-[10px] tracking-[0.22em] text-(--mf-text-muted)/80 uppercase">
        Wins the round
      </p>
      {reason ? (
        <p className="mt-1.5 text-[9px] tracking-[0.2em] text-(--mf-text-muted)/55 uppercase">
          {reason}
        </p>
      ) : null}
    </div>
  )
}

function PlayerAchievementInterstitial({
  card,
  player,
  teamName,
  side,
  emphasis,
}: {
  card: Exclude<BroadcastInterstitial, { type: "round-winner" }>
  player?: PlayerState
  teamName?: string
  side?: Side
  emphasis: "none" | "label" | "ratio"
}) {
  const portraits = useOverlayPortraits(
    player
      ? { ...player, side: side ?? player.side }
      : card.playerSteamId
        ? { steamId: card.playerSteamId, name: "", side: side ?? "CT" }
        : null
  )
  const displayName = usePlayerDisplayName(
    player ?? (card.playerSteamId ? { steamId: card.playerSteamId, name: "" } : null)
  )
  const name = displayName !== EMPTY_MARK ? displayName : (player?.name ?? EMPTY_MARK)
  const kicker = card.type === "ace" ? "ACE" : card.type === "clutch" ? "CLUTCH" : "MVP"
  const portraitHeight = card.type === "ace" ? "h-[228px]" : "h-[200px]"

  return (
    <div className="flex flex-col items-center">
      <p
        className={
          emphasis === "label"
            ? "mf-display mt-3.5 text-[52px] leading-none tracking-[0.08em] uppercase"
            : "mt-3.5 text-[13px] tracking-[0.28em] text-(--mf-text-muted) uppercase"
        }
        style={emphasis === "label" ? { color: "var(--mf-interstitial-accent)" } : undefined}
      >
        {kicker}
      </p>
      <div className={`relative mt-3 w-full ${portraitHeight} overflow-hidden bg-(--mf-surface)/80`}>
        <PlayerPortrait portraits={portraits} className="mf-interstitial-portrait" />
      </div>
      {emphasis === "ratio" && card.type === "clutch" ? (
        <>
          <p
            className="mf-display mt-3 text-[56px] leading-none tracking-[0.04em] uppercase"
            style={{ color: "var(--mf-interstitial-accent)" }}
          >
            1v{card.opponentsAtClutchStart}
          </p>
          <p className="mt-2 mb-4 truncate px-5 text-[16px] font-semibold tracking-[0.1em] text-(--mf-text) uppercase">
            {name}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 truncate px-5 text-[20px] font-semibold tracking-[0.08em] text-(--mf-text) uppercase">
            {name}
          </p>
          {card.type === "mvp" && teamName ? (
            <p className="mt-1 truncate px-5 text-[10px] tracking-[0.18em] text-(--mf-text-muted) uppercase">
              {teamName}
            </p>
          ) : null}
          <AchievementStat card={card} />
        </>
      )}
    </div>
  )
}

function AchievementStat({
  card,
}: {
  card: Exclude<BroadcastInterstitial, { type: "round-winner" }>
}) {
  if (card.type === "clutch") {
    return (
      <p className="mf-display mt-2 mb-4 text-[22px] leading-none tracking-[0.12em] text-(--mf-text) uppercase">
        1v{card.opponentsAtClutchStart}
      </p>
    )
  }
  if (card.type === "ace") {
    return (
      <p className="mf-display mt-2 mb-4 text-[22px] leading-none tracking-[0.12em] text-(--mf-text) uppercase">
        {card.roundKills} KILLS
      </p>
    )
  }
  if (card.roundKills <= 0) {
    return <div className="mb-4" />
  }
  return (
    <p className="mf-display mt-2 mb-4 text-[18px] leading-none tracking-[0.12em] text-(--mf-text) uppercase">
      {card.roundKills} {card.roundKills === 1 ? "KILL" : "KILLS"}
    </p>
  )
}
