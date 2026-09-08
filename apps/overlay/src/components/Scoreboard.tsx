import type { GameState, TeamState } from "@workspace/game-state"

import { formatRoundPhase, mapDisplayName } from "../hud/format"

export function Scoreboard({ state }: { state: GameState }) {
  const left = state.teams[0]
  const right = state.teams[1]

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-7 px-1">
      <TeamBlock team={left} align="left" />
      <MatchContext state={state} />
      <TeamBlock team={right} align="right" />
    </header>
  )
}

function MatchContext({ state }: { state: GameState }) {
  return (
    <div className="flex min-w-48 flex-col items-center justify-center px-5">
      <div className="text-[17px] font-semibold tracking-[0.12em] text-(--mf-text) uppercase">
        {mapDisplayName(state.map.name)}
      </div>
      <div className="mt-1 text-[13px] font-medium tracking-[0.1em] text-(--mf-text) uppercase">
        R{state.map.round} · {formatRoundPhase(state.round.phase)}
      </div>
      <div className="mt-2.5 h-px w-14 bg-(--mf-accent)" />
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
