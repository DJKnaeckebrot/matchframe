import type { PlayerState, WeaponState } from "@workspace/game-state"

import { formatMoney, mainWeapon, weaponShortLabel } from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"
import { cardLifeClass } from "../portraits/card-layout"
import { useOverlayPortraits, usePlayerDisplayName } from "../portraits/use-portrait"
import { CrosshairMark, SkullMark } from "./hud-marks"
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
  const healthColor = player.health <= 20 ? "var(--mf-danger)" : "rgb(255 255 255 / 0.94)"
  const dead = !player.alive
  const weapon = mainWeapon(player)
  const active = player.equipment.activeWeapon ?? player.equipment.primary
  const portraits = useOverlayPortraits(player, number)
  const displayName = usePlayerDisplayName(player)

  return (
    <section
      className={`relative flex h-[216px] w-full overflow-hidden bg-(--mf-background)/70 ${cardLifeClass(false, dead)}`}
    >
      <div className="relative h-full w-[200px] shrink-0 overflow-hidden bg-(--mf-surface)">
        <PlayerPortrait portraits={portraits} className="z-[1]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex h-11 shrink-0 items-center gap-2 px-3 text-(--mf-text)"
          style={{ background: accent }}
        >
          <div className="min-w-0 flex-1">
            {teamName ? (
              <span className="block truncate text-[9px] tracking-[0.16em] text-(--mf-text)/75 uppercase">
                {teamName}
              </span>
            ) : null}
            <span className="block truncate text-[18px] leading-tight font-semibold tracking-wide uppercase">
              {displayName}
            </span>
          </div>
          {player.equipment.hasHelmet ? (
            <EquipmentIcon type="helmet" decorative />
          ) : player.armor > 0 ? (
            <EquipmentIcon type="armor" decorative />
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center bg-(--mf-surface)/92 px-3">
          {player.alive ? (
            <>
              <span className="mf-display text-[34px] leading-none font-semibold tabular-nums text-(--mf-text)">
                {player.health}
              </span>
              <div className="mt-2 h-2.5 w-full bg-black/30">
                <div className="h-full" style={{ width: `${player.health}%`, background: healthColor }} />
              </div>
            </>
          ) : (
            <span className="text-[14px] font-semibold tracking-[0.2em] text-(--mf-text-muted) uppercase">
              Dead
            </span>
          )}
        </div>
        <div className="flex h-11 shrink-0 items-center gap-2 bg-black/55 px-3">
          <span className="flex items-center gap-1 text-[12px] tabular-nums text-(--mf-text-muted)">
            <CrosshairMark />
            {player.kills}
          </span>
          <span className="flex items-center gap-1 text-[12px] tabular-nums text-(--mf-text-muted)">
            <SkullMark />
            {player.deaths}
          </span>
          <span className="ml-auto flex min-w-0 items-center gap-2 text-(--mf-text)">
            <LoadoutIcons player={player} align="right" />
            {weapon ? (
              <WeaponIcon weaponId={weapon.id} label={weaponShortLabel(weapon)} size="sm" decorative />
            ) : null}
            <Ammo weapon={active} />
            <span className="text-[13px] tabular-nums">{formatMoney(player.money)}</span>
          </span>
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
    <span className="mf-display shrink-0 text-[20px] leading-none tabular-nums">
      <span className="text-(--mf-text)">{weapon.ammoClip}</span>
      {weapon.ammoReserve !== undefined ? (
        <span className="text-[13px] text-(--mf-text-muted)">/{weapon.ammoReserve}</span>
      ) : null}
    </span>
  )
}
