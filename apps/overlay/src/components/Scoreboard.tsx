import type {
  GameState,
  RoundDisplayState,
  TeamObjectiveProgress,
  TeamState,
} from "@workspace/game-state"
import {
  getLogicalTeamAliveCount,
  getRoundDisplayState,
  getTeamObjectiveProgress,
} from "@workspace/game-state"

import { overlayTeamName } from "@workspace/presentation"
import {
  formatWinReason,
  seriesSlots,
  teamBroadcastName,
  type BrandingSlot,
  type OverlayBranding,
  type OverlayShow,
} from "../broadcast/presentation"
import {
  snapshotFromBomb,
  useObjectivePresentation,
  type ObjectivePresentation,
} from "../hud/countdown"
import {
  formatClock,
  formatRemaining,
  formatRoundHeadline,
  mapDisplayName,
} from "../hud/format"
import { ObjectiveIcon } from "../icons"

const ROSTER_PIPS = 5

export function Scoreboard({ state, show }: { state: GameState; show: OverlayShow }) {
  const left = state.teams[0]
  const right = state.teams[1]
  const presented = useObjectivePresentation(snapshotFromBomb(state.bomb))
  const leftProgress = withPresented(
    left ? getTeamObjectiveProgress(state, left.id) : { kind: "none" as const },
    presented
  )
  const rightProgress = withPresented(
    right ? getTeamObjectiveProgress(state, right.id) : { kind: "none" as const },
    presented
  )
  const showBars = leftProgress.kind !== "none" || rightProgress.kind !== "none"
  const plantedBar = leftProgress.kind === "bomb" || rightProgress.kind === "bomb"

  return (
    <header className="bg-(--mf-surface)/92">
      <MetaStrip slots={show.slots} mapName={state.map.name} />
      <div className="grid grid-cols-[1fr_168px_1fr] items-stretch">
        <TeamBlock
          team={left}
          name={left ? overlayTeamName(show.branding, "left", left.name) : undefined}
          align="left"
          alive={left ? getLogicalTeamAliveCount(state, left.id) : 0}
          maps={seriesSlots(show.series, left?.seriesWins)}
        />
        <CenterWell
          state={state}
          branding={show.branding}
          presented={presented}
          result={show.chrome.result}
        />
        <TeamBlock
          team={right}
          name={right ? overlayTeamName(show.branding, "right", right.name) : undefined}
          align="right"
          alive={right ? getLogicalTeamAliveCount(state, right.id) : 0}
          maps={seriesSlots(show.series, right?.seriesWins)}
        />
        {showBars ? (
          <>
            <ObjectiveSlot progress={leftProgress} align="left" planted={plantedBar} />
            <div />
            <ObjectiveSlot progress={rightProgress} align="right" planted={plantedBar} />
          </>
        ) : null}
      </div>
    </header>
  )
}

function MetaStrip({ slots, mapName }: { slots: readonly BrandingSlot[]; mapName: string }) {
  return (
    <div className="flex h-[22px] items-center justify-between gap-4 border-b border-(--mf-text)/10 px-3">
      <div className="flex min-w-0 items-center gap-0">
        {slots.map((slot, index) => (
          <span key={slot.id} className="flex items-center">
            {index > 0 ? (
              <span className="mx-2.5 text-(--mf-text)/25" aria-hidden="true">
                ·
              </span>
            ) : null}
            <BrandingMark slot={slot} />
          </span>
        ))}
      </div>
      <span className="shrink-0 text-[10px] tracking-[0.18em] text-(--mf-text-muted) uppercase">
        {mapDisplayName(mapName)}
      </span>
    </div>
  )
}

function BrandingMark({ slot }: { slot: BrandingSlot }) {
  return (
    <span className="flex items-center gap-1.5">
      {slot.imageUrl ? (
        <img
          src={slot.imageUrl}
          alt={slot.text ? "" : slot.id}
          className="h-3.5 max-w-16 object-contain object-left"
        />
      ) : null}
      {slot.text ? (
        <span className="truncate text-[10px] tracking-[0.18em] text-(--mf-text)/80 uppercase">
          {slot.text}
        </span>
      ) : null}
    </span>
  )
}

function TeamBlock({
  team,
  name,
  align,
  alive,
  maps,
}: {
  team: TeamState | undefined
  name?: string
  align: "left" | "right"
  alive: number
  maps: readonly boolean[] | undefined
}) {
  if (!team) {
    return <div />
  }

  const sideColor = team.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const mirrored = align === "right"
  const won = maps?.filter(Boolean).length

  return (
    <div className={`flex min-w-0 items-center ${mirrored ? "flex-row-reverse" : ""}`}>
      <div className="h-full w-[3px] self-stretch" style={{ background: sideColor }} />
      <div
        className={`flex min-w-0 flex-1 items-center gap-3 py-2 ${
          mirrored ? "flex-row-reverse pr-3 pl-4" : "pr-4 pl-3"
        }`}
      >
        <div className={`min-w-0 flex-1 ${mirrored ? "text-right" : ""}`}>
          <div className="text-[10px] tracking-[0.22em] uppercase" style={{ color: sideColor }}>
            {team.side}
          </div>
          <div className="truncate text-[20px] font-semibold tracking-wide text-(--mf-text) uppercase">
            {name ?? team.name}
          </div>
          <AlivePips sideColor={sideColor} alive={alive} mirrored={mirrored} />
        </div>
        {maps ? (
          <SeriesPips
            maps={maps}
            sideColor={sideColor}
            label={`${won ?? 0} of ${maps.length} maps`}
          />
        ) : null}
        <div className="mf-display text-[44px] leading-none tabular-nums text-(--mf-text)">
          {team.score}
        </div>
      </div>
    </div>
  )
}

function SeriesPips({
  maps,
  sideColor,
  label,
}: {
  maps: readonly boolean[]
  sideColor: string
  label: string
}) {
  return (
    <div className="flex flex-col justify-center gap-[3px]" aria-label={label}>
      {maps.map((won, index) => (
        <span
          key={index}
          className="h-[3px] w-3.5"
          style={{
            background: won
              ? sideColor
              : "color-mix(in srgb, var(--mf-text) 22%, transparent)",
          }}
        />
      ))}
    </div>
  )
}

function AlivePips({
  sideColor,
  alive,
  mirrored,
}: {
  sideColor: string
  alive: number
  mirrored: boolean
}) {
  return (
    <div
      className={`mt-1 flex gap-1 ${mirrored ? "justify-end" : ""}`}
      aria-label={`${alive} alive`}
    >
      {Array.from({ length: ROSTER_PIPS }, (_, index) => (
        <span
          key={index}
          className="h-1.5 w-1.5"
          style={{ background: index < alive ? sideColor : "color-mix(in srgb, var(--mf-text) 22%, transparent)" }}
        />
      ))}
    </div>
  )
}

function CenterWell({
  state,
  branding,
  presented,
  result,
}: {
  state: GameState
  branding: OverlayBranding
  presented: ObjectivePresentation
  result: boolean
}) {
  const display = getRoundDisplayState(state)
  if (result && display.kind === "over") {
    return (
      <WinnerWell
        display={display}
        name={
          teamBroadcastName(state.teams, display.winnerTeamId, branding) ??
          display.winnerName ??
          display.winTeam ??
          "—"
        }
      />
    )
  }

  const planted = display.kind === "bomb"
  const bombRemaining = presented.bomb?.remaining
  const clock = planted
    ? bombRemaining === undefined
      ? "—"
      : formatRemaining(bombRemaining)
    : display.timeRemaining !== undefined
      ? formatClock(display.timeRemaining)
      : "•"
  const headline = planted
    ? formatRoundHeadline("bomb", display.round)
    : formatRoundHeadline(display.kind, display.round, display.timeoutSide)

  return (
    <div
      className={`flex flex-col items-center justify-center px-2 py-1.5 ${
        planted ? "bg-(--mf-t)/18" : "bg-(--mf-background)/55"
      }`}
    >
      <div
        className={`flex items-center gap-1 text-[10px] font-semibold tracking-[0.16em] uppercase ${
          planted ? "text-(--mf-t)" : "text-(--mf-text-muted)"
        }`}
      >
        {planted ? <ObjectiveIcon type="bomb" decorative /> : null}
        <span className={planted ? "mf-planted-pulse" : undefined}>{headline}</span>
      </div>
      <div
        className={`mf-display mt-0.5 text-[28px] leading-none tabular-nums ${
          planted ? "text-(--mf-t)" : "text-(--mf-text)"
        }`}
      >
        {clock}
      </div>
    </div>
  )
}

function WinnerWell({ display, name }: { display: RoundDisplayState; name: string }) {
  const color = display.winTeam === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const reason = formatWinReason(display.winReason)

  return (
    <div
      className="flex flex-col items-center justify-center px-2 py-1.5 text-(--mf-text)"
      style={{ background: `color-mix(in srgb, ${color} 78%, var(--mf-background))` }}
    >
      <div className="text-[9px] font-semibold tracking-[0.2em] uppercase opacity-80">
        {reason ?? `ROUND ${display.round}`}
      </div>
      <div className="mf-display max-w-full truncate text-[22px] leading-none tracking-wide uppercase">
        {name}
      </div>
      <div className="text-[9px] font-semibold tracking-[0.18em] uppercase">Wins</div>
    </div>
  )
}

function ObjectiveSlot({
  progress,
  align,
  planted,
}: {
  progress: TeamObjectiveProgress
  align: "left" | "right"
  planted: boolean
}) {
  if (progress.kind === "none") {
    return <div className={planted ? "h-5" : "h-3.5"} />
  }
  return <ObjectiveBar progress={progress} align={align} planted={planted} />
}

function ObjectiveBar({
  progress,
  align,
  planted,
}: {
  progress: Extract<TeamObjectiveProgress, { kind: "bomb" | "defuse" }>
  align: "left" | "right"
  planted: boolean
}) {
  const shown = progress.remaining
  const color = progress.kind === "bomb" ? "var(--mf-t)" : "var(--mf-ct)"
  const word = progress.kind === "bomb" ? "BOMB" : "DEFUSE"
  const label = shown === undefined ? word : `${word} ${formatRemaining(shown)}`
  const ratio = progressRatio(shown, progress.duration)
  const mirrored = align === "right"
  const bombTrack = progress.kind === "bomb"

  return (
    <div
      className={`flex items-center gap-2 px-3 pb-1 ${planted ? "h-5" : "h-3.5"} ${
        mirrored ? "flex-row-reverse" : ""
      }`}
    >
      <span
        className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase tabular-nums whitespace-nowrap"
        style={{ color }}
      >
        <ObjectiveIcon type={progress.kind} decorative />
        {label}
      </span>
      <div
        className={`relative min-w-0 flex-1 bg-(--mf-text)/15 ${bombTrack ? "h-2" : "h-[3px]"}`}
      >
        {ratio !== undefined ? (
          <div
            className="absolute top-0 h-full"
            style={{
              width: `${ratio * 100}%`,
              background: color,
              ...(mirrored ? { right: 0 } : { left: 0 }),
            }}
          />
        ) : shown === undefined ? (
          <div className="absolute inset-0" style={{ background: color, opacity: 0.55 }} />
        ) : null}
      </div>
    </div>
  )
}

function withPresented(
  progress: TeamObjectiveProgress,
  presented: ObjectivePresentation
): TeamObjectiveProgress {
  if (progress.kind === "bomb" && presented.bomb) {
    return { kind: "bomb", ...presented.bomb }
  }
  if (progress.kind === "defuse" && presented.defuse) {
    return { kind: "defuse", ...presented.defuse }
  }
  return progress
}

function progressRatio(remaining: number | undefined, duration: number | undefined): number | undefined {
  if (remaining === undefined || duration === undefined || duration <= 0) {
    return undefined
  }
  return Math.min(1, Math.max(0, remaining / duration))
}
