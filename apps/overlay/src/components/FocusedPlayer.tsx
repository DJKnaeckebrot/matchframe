import type { PlayerState, WeaponState } from "@workspace/game-state"

import { formatMoney } from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"

export function FocusedPlayer({ player }: { player: PlayerState }) {
  const sideColor = player.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const healthColor =
    player.health <= 20 ? "var(--mf-danger)" : "var(--mf-success)"
  const weapon = player.equipment.activeWeapon ?? player.equipment.primary
  const dead = !player.alive

  return (
    <section
      className={`relative h-[76px] w-[600px] overflow-hidden ${dead ? "bg-(--mf-background)" : "bg-(--mf-surface)"}`}
    >
      <div className={`grid h-full grid-cols-[4px_1fr] items-stretch ${dead ? "grayscale opacity-65" : ""}`}>
        <div style={{ background: sideColor }} />
        <div className="grid h-full min-h-0 grid-cols-[1fr_auto] grid-rows-[1fr_2rem] gap-x-6 px-3 py-2">
          <div className="flex min-h-0 min-w-0 items-center gap-2.5">
            <span className="whitespace-nowrap text-[20px] font-semibold leading-none tracking-wide text-(--mf-text) uppercase">
              {player.name || player.steamId}
            </span>
            <span
              className="text-[11px] tracking-[0.18em] uppercase"
              style={{ color: sideColor }}
            >
              {player.side}
            </span>
          </div>
          <div className="flex min-h-0 items-center justify-end gap-3 text-[12px] leading-none tabular-nums text-(--mf-text-muted)">
            <span className="text-[17px] font-semibold text-(--mf-text)">
              {player.health}
            </span>
            <span className="flex items-center gap-1">
              {player.armor}
              {player.equipment.hasHelmet ? (
                <span className="text-(--mf-text)">
                  <EquipmentIcon type="helmet" />
                </span>
              ) : null}
            </span>
            <span>{formatMoney(player.money)}</span>
          </div>
          <WeaponAmmo weapon={weapon} />
          <div className="flex min-h-0 items-center justify-end gap-4">
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
            <span className="text-(--mf-text)/80">
              <LoadoutIcons player={player} align="right" />
            </span>
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
    return <div className="flex h-8 min-h-0 items-center text-[13px] leading-none text-(--mf-text-muted)">—</div>
  }

  return (
    <div className="flex h-8 min-h-0 items-center gap-2.5 overflow-hidden text-(--mf-text)">
      <WeaponIcon
        weaponId={weapon.id}
        label={weapon.name}
        size="lg"
        decorative
      />
      <div className="flex h-8 min-h-0 min-w-0 flex-col justify-center overflow-hidden leading-none">
        <span className="flex h-4 min-h-0 items-center truncate text-[12px] leading-none tracking-wide text-(--mf-text-muted) uppercase">
          {weapon.name}
        </span>
        <span className="flex h-4 min-h-0 items-center tabular-nums leading-none">
          {weapon.ammoClip !== undefined ? (
            <>
              <span className="text-[13px] font-semibold leading-none">{weapon.ammoClip}</span>
              {weapon.ammoReserve !== undefined ? (
                <span className="text-[12px] leading-none text-(--mf-text-muted)">
                  /{weapon.ammoReserve}
                </span>
              ) : null}
            </>
          ) : (
            "\u00a0"
          )}
        </span>
      </div>
    </div>
  )
}
