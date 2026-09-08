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

export function Scoreboard({ state }: { state: GameState }) {
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

  return (
    <div>
      <header className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-x-7 gap-y-1 px-1">
        <TeamBlock team={left} align="left" />
        <MatchContext state={state} left={left} right={right} />
        <TeamBlock team={right} align="right" />
        {showBars ? (
          <>
            <ObjectiveSlot progress={leftProgress} align="left" />
            <div />
            <ObjectiveSlot progress={rightProgress} align="right" />
          </>
        ) : null}
      </header>
      <RoundResultBanner state={state} />
    </div>
  )
}

function MatchContext({
  state,
  left,
  right,
}: {
  state: GameState
  left: TeamState | undefined
  right: TeamState | undefined
}) {
  const display = getRoundDisplayState(state)
  const planted = display.kind === "bomb"
  const leftAlive = left ? getLogicalTeamAliveCount(state, left.id) : 0
  const rightAlive = right ? getLogicalTeamAliveCount(state, right.id) : 0
  const detail = planted ? `R${display.round}` : roundDetail(display)

  return (
    <div className="flex min-w-52 flex-col items-center justify-center bg-(--mf-surface) px-5 py-2">
      <div className="text-[17px] font-semibold tracking-[0.14em] text-(--mf-text) uppercase">
        {mapDisplayName(display.mapName)}
      </div>
      <div
        className={`mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold tracking-[0.12em] uppercase ${
          planted ? "text-(--mf-t)" : "text-(--mf-text)"
        }`}
      >
        {planted ? <ObjectiveIcon type="bomb" decorative /> : null}
        <span className={planted ? "mf-planted-pulse" : undefined}>
          {formatRoundHeadline(display.kind, display.round, display.timeoutSide)}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-3.5">
        <AliveCount team={left} count={leftAlive} />
        <span className="min-w-12 text-center text-[16px] font-semibold tracking-wide whitespace-nowrap tabular-nums text-(--mf-text)">
          {detail}
        </span>
        <AliveCount team={right} count={rightAlive} />
      </div>
    </div>
  )
}

function roundDetail(display: RoundDisplayState): string {
  if (display.kind === "over") {
    if (display.winnerName) {
      return `${display.winnerName.toUpperCase()} WIN`
    }
    if (display.winTeam) {
      return `${display.winTeam} WIN`
    }
    return "OVER"
  }
  if (display.timeRemaining !== undefined) {
    return formatClock(display.timeRemaining)
  }
  return "•"
}

function AliveCount({ team, count }: { team: TeamState | undefined; count: number }) {
  const color = team?.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  return (
    <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
      {count}
    </span>
  )
}

function RoundResultBanner({ state }: { state: GameState }) {
  const display = getRoundDisplayState(state)
  if (display.kind !== "over" || !display.winTeam) {
    return null
  }

  const label = display.winnerName
    ? `${display.winnerName.toUpperCase()} WINS THE ROUND`
    : `${display.winTeam} WIN`
  const color = display.winTeam === "CT" ? "var(--mf-ct)" : "var(--mf-t)"

  return (
    <div className="mt-3 flex justify-center">
      <div className="flex items-center gap-3 bg-(--mf-surface) px-4 py-1.5">
        <span className="h-3.5 w-1 shrink-0" style={{ background: color }} />
        <span className="text-[13px] font-semibold tracking-[0.16em] text-(--mf-text) uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}

function TeamBlock({
  team,
  align,
}: {
  team: TeamState | undefined
  align: "left" | "right"
}) {
  if (!team) {
    return <div />
  }

  const sideColor = team.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const mirrored = align === "right"

  return (
    <div
      className={`flex items-center gap-5 bg-(--mf-surface) ${
        mirrored ? "flex-row-reverse" : ""
      }`}
    >
      <div className="h-full w-1 self-stretch" style={{ background: sideColor }} />
      <div className={`flex min-w-0 flex-1 flex-col py-3 ${mirrored ? "items-end pr-5" : "pl-1.5 pr-5"}`}>
        <div className="text-[12px] tracking-[0.2em] uppercase" style={{ color: sideColor }}>
          {team.side}
        </div>
        <div className="truncate text-[25px] font-semibold tracking-wide text-(--mf-text) uppercase">
          {team.name}
        </div>
      </div>
      <div className="px-5 text-[48px] leading-none font-semibold tabular-nums text-(--mf-text)">
        {team.score}
      </div>
    </div>
  )
}

function ObjectiveSlot({
  progress,
  align,
}: {
  progress: TeamObjectiveProgress
  align: "left" | "right"
}) {
  if (progress.kind === "none") {
    return <div className="h-4" />
  }
  return <ObjectiveBar progress={progress} align={align} />
}

function ObjectiveBar({
  progress,
  align,
}: {
  progress: Extract<TeamObjectiveProgress, { kind: "bomb" | "defuse" }>
  align: "left" | "right"
}) {
  const shown = progress.remaining
  const color = progress.kind === "bomb" ? "var(--mf-t)" : "var(--mf-ct)"
  const word = progress.kind === "bomb" ? "BOMB" : "DEFUSE"
  const label = shown === undefined ? word : `${word} ${formatRemaining(shown)}`
  const ratio = progressRatio(shown, progress.duration)
  const mirrored = align === "right"

  return (
    <div
      className={`flex h-4 items-center gap-2 ${mirrored ? "flex-row-reverse" : ""}`}
    >
      <span
        className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase tabular-nums whitespace-nowrap"
        style={{ color }}
      >
        <ObjectiveIcon type={progress.kind} decorative />
        {label}
      </span>
      <div className="relative h-[3px] min-w-0 flex-1 bg-(--mf-text)/15">
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
