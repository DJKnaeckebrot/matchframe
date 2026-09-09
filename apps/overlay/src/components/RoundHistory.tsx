import type { GameState, RoundWinReason } from "@workspace/game-state"

import { formatWinReason } from "../broadcast/presentation"
import { roundHistoryTrack, type RoundHistorySlot } from "../hud/round-history"
import { resolveObjectiveIcon } from "../icons"
import { PackIcon } from "../icons/pack-icon"
import { ClockMark, SkullMark } from "./hud-marks"

export function RoundHistory({ state, visible }: { state: GameState; visible: boolean }) {
  const track = roundHistoryTrack(state)
  const label = track.overtime ? `Overtime ${track.overtime} round history` : "Round history"

  return (
    <div className={`mf-history ${visible ? "mf-history-open" : ""}`}>
      <nav aria-label={label} aria-hidden={!visible} className="min-h-0 overflow-hidden">
        <div className="border-t border-(--mf-text)/10 bg-(--mf-background)/55 px-3 pt-1.5 pb-2">
          {track.overtime ? (
            <div className="mb-1 text-[9px] font-semibold tracking-[0.2em] text-(--mf-accent) uppercase">
              OT{track.overtime}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Half slots={track.halves[0]} labels={track.labels} />
            <div className="mb-0.5 h-4 w-px shrink-0 bg-(--mf-text)/35" aria-hidden="true" />
            <Half slots={track.halves[1]} labels={track.labels} />
          </div>
        </div>
      </nav>
    </div>
  )
}

function Half({
  slots,
  labels,
}: {
  slots: readonly RoundHistorySlot[]
  labels: readonly number[]
}) {
  const columns = `repeat(${slots.length}, minmax(0, 1fr))`
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-0.5 grid" style={{ gridTemplateColumns: columns }}>
        {slots.map((slot) => (
          <span
            key={slot.round}
            className="text-center text-[8px] leading-none tracking-[0.08em] text-(--mf-text-muted) tabular-nums"
          >
            {labels.includes(slot.round) ? slot.round : "\u00a0"}
          </span>
        ))}
      </div>
      <div className="grid gap-0.75" style={{ gridTemplateColumns: columns }}>
        {slots.map((slot) => (
          <Pip key={slot.round} slot={slot} />
        ))}
      </div>
    </div>
  )
}

function Pip({ slot }: { slot: RoundHistorySlot }) {
  const color = slot.winner === "CT" ? "var(--mf-ct)" : slot.winner === "T" ? "var(--mf-t)" : undefined
  const reason = formatWinReason(slot.reason)
  const label = slot.winner
    ? `Round ${slot.round} ${slot.winner}${reason ? ` ${reason.toLowerCase()}` : ""}`
    : `Round ${slot.round}`

  return (
    <span
      className={`flex h-3.75 items-center justify-center ${
        slot.current && !slot.winner ? "outline outline-(--mf-accent)/70 -outline-offset-1" : ""
      }`}
      style={{
        background: color ?? "color-mix(in srgb, var(--mf-text) 12%, transparent)",
        color: "var(--mf-text)",
      }}
      title={label}
      aria-label={label}
    >
      {slot.winner ? <ReasonMark reason={slot.reason} /> : null}
    </span>
  )
}

function ReasonMark({ reason }: { reason?: RoundWinReason }) {
  const iconClass = "size-2.5"
  if (reason === "bomb_exploded") {
    const src = resolveObjectiveIcon("bomb")
    return src ? <PackIcon src={src} decorative className={iconClass} /> : <SkullMark size={iconClass} />
  }
  if (reason === "bomb_defused") {
    const src = resolveObjectiveIcon("defuse")
    return src ? <PackIcon src={src} decorative className={iconClass} /> : <SkullMark size={iconClass} />
  }
  if (reason === "time_expired") {
    return <ClockMark size={iconClass} />
  }
  return <SkullMark size={iconClass} />
}
