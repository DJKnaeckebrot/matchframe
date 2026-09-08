import type { PlayerState, WeaponState } from "@workspace/game-state"

import { formatMoney, mainWeapon, weaponShortLabel } from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"
import { useOverlayPortrait, usePlayerDisplayName } from "../portraits/use-portrait"
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
  const portrait = useOverlayPortrait(player, number)
  const displayName = usePlayerDisplayName(player)

  return (
    <section
      className={`flex w-full flex-col overflow-hidden bg-(--mf-background)/88 ${dead ? "grayscale opacity-70" : ""}`}
    >
      <div className="h-0.5 shrink-0" style={{ background: accent }} />
      <div
        className="relative h-[168px] overflow-hidden"
        style={{ background: `color-mix(in srgb, ${accent} 20%, var(--mf-background))` }}
      >
        <PlayerPortrait portrait={portrait} accent={accent} className="absolute inset-0 z-0" />
        <div className="absolute inset-x-0 bottom-0 z-10 bg-black/55 px-2 py-1.5">
          <span className="text-[9px] tracking-[0.22em] text-(--mf-text-muted) uppercase">Observed</span>
          <span className="block truncate text-[15px] font-semibold tracking-wide text-(--mf-text) uppercase">
            {displayName}
          </span>
          {teamName ? (
            <span className="block truncate text-[10px] tracking-[0.14em] text-(--mf-text)/70 uppercase">
              {teamName}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-end justify-between gap-1 px-2 pt-1.5">
        {weapon ? (
          <WeaponIcon weaponId={weapon.id} label={weaponShortLabel(weapon)} size="lg" decorative />
        ) : (
          <span />
        )}
        <Ammo weapon={active} />
      </div>
      <div className="flex justify-end px-2 pt-1 text-(--mf-text)">
        <LoadoutIcons player={player} align="right" />
      </div>
      {player.alive ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5">
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
        <div className="px-2 py-1.5 text-[10px] tracking-[0.14em] text-(--mf-text-muted) uppercase">
          Dead
        </div>
      )}
      <div className="flex items-center gap-3 bg-black/35 px-2 py-1.5 text-[12px] tabular-nums text-(--mf-text-muted)">
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
