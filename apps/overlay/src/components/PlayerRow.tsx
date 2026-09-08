import type { PlayerState, Side } from "@workspace/game-state"

import { formatMoney, mainWeaponLabel } from "../hud/format"
import { UtilityMarks } from "../hud/icons"

export function PlayerRow({
  player,
  side,
  align,
}: {
  player: PlayerState | null
  side: Side
  align: "left" | "right"
}) {
  const sideColor = side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const mirrored = align === "right"
  const alive = player?.alive ?? false
  const health = player?.health ?? 0
  const healthColor =
    health <= 20 ? "var(--mf-danger)" : "var(--mf-success)"
  const empty = !player
  const dead = Boolean(player && !alive)
  const tone = empty ? "opacity-35" : dead ? "grayscale opacity-65" : ""

  return (
    <li
      className={`relative overflow-hidden ${
        empty
          ? "bg-(--mf-background)/70"
          : dead
            ? "bg-(--mf-background)"
            : "bg-(--mf-surface)"
      }`}
    >
      <div className="flex h-14 items-center gap-2.5 px-2.5 pb-1">
        {mirrored ? (
          <>
            <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${tone}`}>
              <Secondary player={player} mirrored />
              <div className="min-w-2 flex-1" />
              <Identity player={player} mirrored />
            </div>
            <span className="h-full w-1 shrink-0 self-stretch" style={{ background: sideColor }} />
          </>
        ) : (
          <>
            <span className="h-full w-1 shrink-0 self-stretch" style={{ background: sideColor }} />
            <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${tone}`}>
              <Identity player={player} mirrored={false} />
              <div className="min-w-2 flex-1" />
              <Secondary player={player} mirrored={false} />
            </div>
          </>
        )}
      </div>
      {alive ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-(--mf-surface-elevated)">
          <div
            className="h-full"
            style={{
              width: `${health}%`,
              background: healthColor,
            }}
          />
        </div>
      ) : null}
    </li>
  )
}

function Identity({
  player,
  mirrored,
}: {
  player: PlayerState | null
  mirrored: boolean
}) {
  return (
    <div
      className={`flex shrink-0 items-baseline gap-2.5 ${mirrored ? "flex-row-reverse" : ""}`}
    >
      <span className="whitespace-nowrap text-[18px] font-semibold text-(--mf-text)">
        {player ? player.name || player.steamId : "—"}
      </span>
      <span className="text-[17px] font-semibold tabular-nums text-(--mf-text)">
        {player ? player.health : ""}
      </span>
    </div>
  )
}

function Secondary({
  player,
  mirrored,
}: {
  player: PlayerState | null
  mirrored: boolean
}) {
  if (!player) {
    return <div />
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${mirrored ? "flex-row-reverse" : ""}`}
    >
      <span className="shrink-0 text-[11px] tracking-wide text-(--mf-text-muted) uppercase">
        {mainWeaponLabel(player)}
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-(--mf-text-muted)">
        {formatMoney(player.money)}
      </span>
      <UtilityMarks player={player} align={mirrored ? "left" : "right"} />
    </div>
  )
}
