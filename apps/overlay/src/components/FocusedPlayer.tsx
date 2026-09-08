import type { PlayerState, WeaponState } from "@workspace/game-state"

import { formatMoney, mainWeapon, weaponShortLabel } from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"
import { cardLifeClass } from "../portraits/card-layout"
import { useOverlayPortraits, usePlayerDisplayName } from "../portraits/use-portrait"
import { HeartMark } from "./hud-marks"
import { PlayerPortrait } from "./PlayerPortrait"

export function FocusedPlayer({
  player,
  teamName,
  number,
}: {
  player: PlayerState
  teamName?: string
  number?: number
}) {
  const accent = player.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const healthColor = player.health <= 20 ? "var(--mf-danger)" : accent
  const dead = !player.alive
  const weapon = mainWeapon(player)
  const active = player.equipment.activeWeapon ?? player.equipment.primary
  const portraits = useOverlayPortraits(player, number)
  const displayName = usePlayerDisplayName(player)

  return (
    <section
      className={`relative flex w-full flex-col overflow-hidden bg-(--mf-background)/70 ${cardLifeClass(false, dead)}`}
    >
      <div className="h-0.5 shrink-0" style={{ background: accent }} />
      <div className="absolute inset-y-0.5 left-0 z-30 w-0.5" style={{ background: accent }} />
      <div className="relative h-[156px] overflow-hidden bg-(--mf-surface-elevated)/80">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `linear-gradient(to right, color-mix(in srgb, ${accent} 9%, transparent), transparent 50%)`,
          }}
        />
        <PlayerPortrait portraits={portraits} className="z-[1]" />
        <div className="absolute top-1.5 right-1.5 z-20 text-(--mf-text)">
          <LoadoutIcons player={player} align="right" />
        </div>
      </div>
      <div className="relative z-10 bg-(--mf-surface)/94 px-2 py-1.5">
        <span className="text-[9px] tracking-[0.22em] text-(--mf-text-muted) uppercase">Observed</span>
        <span className="block truncate text-[15px] font-semibold tracking-wide text-(--mf-text) uppercase">
          {displayName}
        </span>
        {teamName ? (
          <span className="block truncate text-[10px] tracking-[0.14em] text-(--mf-text)/70 uppercase">
            {teamName}
          </span>
        ) : null}
        <div className="mt-1 flex items-end justify-between gap-1">
          {weapon ? (
            <WeaponIcon weaponId={weapon.id} label={weaponShortLabel(weapon)} size="sm" decorative />
          ) : (
            <span />
          )}
          <Ammo weapon={active} />
        </div>
        {player.alive ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <HeartMark size="size-3.5" />
            <span className="text-[15px] font-semibold tabular-nums">{player.health}</span>
            <div className="h-1.5 min-w-0 flex-1 bg-(--mf-text)/15">
              <div className="h-full" style={{ width: `${player.health}%`, background: healthColor }} />
            </div>
            {player.equipment.hasHelmet ? (
              <EquipmentIcon type="helmet" decorative />
            ) : player.armor > 0 ? (
              <EquipmentIcon type="armor" decorative />
            ) : null}
          </div>
        ) : (
          <div className="mt-1.5 text-[10px] tracking-[0.14em] text-(--mf-text-muted) uppercase">
            Dead
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[12px] tabular-nums text-(--mf-text-muted)">
          <span>
            <span className="text-[10px] tracking-wider">K </span>
            {player.kills}
          </span>
          <span>
            <span className="text-[10px] tracking-wider">D </span>
            {player.deaths}
          </span>
          <span className="ml-auto text-(--mf-text)">{formatMoney(player.money)}</span>
        </div>
      </div>
    </section>
  )
}

function Ammo({ weapon }: { weapon: WeaponState | undefined }) {
  if (!weapon || weapon.ammoClip === undefined) {
    return null
  }
  return (
    <span className="mf-display shrink-0 text-[18px] leading-none tabular-nums">
      <span className="text-(--mf-text)">{weapon.ammoClip}</span>
      {weapon.ammoReserve !== undefined ? (
        <span className="text-[13px] text-(--mf-text-muted)">/{weapon.ammoReserve}</span>
      ) : null}
    </span>
  )
}
