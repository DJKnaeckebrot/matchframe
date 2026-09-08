import type { PlayerState, WeaponState } from "@workspace/game-state"

import { formatMoney, weaponShortLabel } from "../hud/format"
import { HudIcon, UtilityMarks, iconLabel } from "../hud/icons"

export function FocusedPlayer({ player }: { player: PlayerState }) {
  const sideColor = player.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const healthColor =
    player.health <= 20 ? "var(--mf-danger)" : "var(--mf-success)"
  const weapon = player.equipment.activeWeapon ?? player.equipment.primary
  const dead = !player.alive

  return (
    <section
      className={`relative w-[600px] ${dead ? "bg-(--mf-background)" : "bg-(--mf-surface)"}`}
    >
      <div className={`grid grid-cols-[4px_1fr] items-stretch ${dead ? "grayscale opacity-65" : ""}`}>
        <div style={{ background: sideColor }} />
        <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 px-3 py-2">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <span className="whitespace-nowrap text-[20px] font-semibold tracking-wide text-(--mf-text) uppercase">
              {player.name || player.steamId}
            </span>
            <span
              className="text-[11px] tracking-[0.18em] uppercase"
              style={{ color: sideColor }}
            >
              {player.side}
            </span>
          </div>
          <div className="flex items-center justify-end gap-3 text-[12px] tabular-nums text-(--mf-text-muted)">
            <span className="text-[17px] font-semibold text-(--mf-text)">
              {player.health}
            </span>
            <span className="flex items-center gap-1">
              {player.armor}
              {player.equipment.hasHelmet ? (
                <span title={iconLabel("helmet")} className="text-(--mf-text)">
                  <HudIcon name="helmet" />
                </span>
              ) : null}
            </span>
            <span>{formatMoney(player.money)}</span>
          </div>
          <WeaponAmmo weapon={weapon} />
          <div className="flex items-center justify-end gap-4">
            <span className="flex items-center gap-2 text-[12px] tabular-nums text-(--mf-text-muted)">
              <span>
                <span className="text-[10px] tracking-wider">K </span>
                {player.kills}
              </span>
              <span>
                <span className="text-[10px] tracking-wider">A </span>
                {player.assists}
              </span>
              <span>
                <span className="text-[10px] tracking-wider">D </span>
                {player.deaths}
              </span>
            </span>
            <UtilityMarks player={player} align="right" />
          </div>
        </div>
      </div>
      {player.alive ? (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-(--mf-surface-elevated)">
          <div
            className="h-full"
            style={{
              width: `${player.health}%`,
              background: healthColor,
            }}
          />
        </div>
      ) : null}
    </section>
  )
}

function WeaponAmmo({ weapon }: { weapon: WeaponState | undefined }) {
  if (!weapon) {
    return <div className="text-[13px] text-(--mf-text-muted)">—</div>
  }

  return (
    <div className="flex items-baseline gap-1.5 text-(--mf-text)">
      <span className="text-[13px] font-semibold tracking-wide uppercase">
        {weaponShortLabel(weapon)}
      </span>
      {weapon.ammoClip !== undefined ? (
        <span className="tabular-nums">
          <span className="text-[13px] font-semibold">{weapon.ammoClip}</span>
          {weapon.ammoReserve !== undefined ? (
            <span className="text-[12px] text-(--mf-text-muted)">
              /{weapon.ammoReserve}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
