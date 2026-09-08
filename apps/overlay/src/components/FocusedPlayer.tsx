import type { PlayerState, WeaponState } from "@workspace/game-state"

import {
  formatMoney,
  mainWeapon,
  weaponShortLabel,
} from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"
import { HeartMark } from "./hud-marks"

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

  return (
    <section
      className={`flex w-full flex-col overflow-hidden bg-(--mf-background)/85 ${
        dead ? "grayscale opacity-70" : ""
      }`}
    >
      <div className="h-0.5 shrink-0" style={{ background: accent }} />
      <div
        className="relative h-[168px] overflow-hidden"
        style={{
          background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 50%, transparent) 0%, var(--mf-background) 55%)`,
        }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-[88px] leading-none font-semibold text-(--mf-text)/20 tabular-nums">
          {number ?? ""}
        </span>
        <div className="absolute top-2 right-2 left-2 text-(--mf-text)">
          <LoadoutIcons player={player} />
        </div>
        {weapon ? (
          <span className="absolute inset-x-2 bottom-2 flex justify-center text-(--mf-text)">
            <WeaponIcon
              weaponId={weapon.id}
              label={weaponShortLabel(weapon)}
              size="lg"
              decorative
            />
          </span>
        ) : null}
      </div>
      <div
        className="flex items-center gap-2 px-2.5 py-1.5"
        style={{ background: `color-mix(in srgb, ${accent} 35%, var(--mf-surface))` }}
      >
        {number !== undefined ? (
          <span
            className="flex size-6 shrink-0 items-center justify-center text-[13px] font-bold tabular-nums"
            style={{ background: accent, color: "#111418" }}
          >
            {number}
          </span>
        ) : null}
        <span className="truncate text-[15px] font-semibold tracking-wide text-(--mf-text) uppercase">
          {player.name || player.steamId}
        </span>
        {teamName ? (
          <span className="ml-auto shrink-0 text-[10px] tracking-[0.18em] text-(--mf-text)/80 uppercase">
            {teamName}
          </span>
        ) : null}
      </div>
      {player.alive ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <HeartMark size="size-3.5" />
          <span className="text-[15px] font-semibold tabular-nums">{player.health}</span>
          <div className="h-2 min-w-0 flex-1 bg-(--mf-text)/15">
            <div
              className="h-full"
              style={{ width: `${player.health}%`, background: healthColor }}
            />
          </div>
          {player.equipment.hasHelmet ? (
            <EquipmentIcon type="helmet" decorative />
          ) : player.armor > 0 ? (
            <EquipmentIcon type="armor" decorative />
          ) : null}
        </div>
      ) : (
        <div className="h-8" />
      )}
      <div className="flex items-center gap-3 bg-black/35 px-2.5 py-1.5 text-[12px] tabular-nums text-(--mf-text-muted)">
        <span>
          <span className="text-[10px] tracking-wider">K </span>
          {player.kills}
        </span>
        <span>
          <span className="text-[10px] tracking-wider">D </span>
          {player.deaths}
        </span>
        <span className="text-(--mf-text)">{formatMoney(player.money)}</span>
        <Ammo className="ml-auto" weapon={active} />
      </div>
    </section>
  )
}

function Ammo({
  weapon,
  className,
}: {
  weapon: WeaponState | undefined
  className?: string
}) {
  if (!weapon || weapon.ammoClip === undefined) {
    return <span className={className} />
  }
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      <span className="font-semibold text-(--mf-text)">{weapon.ammoClip}</span>
      {weapon.ammoReserve !== undefined ? (
        <span>/{weapon.ammoReserve}</span>
      ) : null}
    </span>
  )
}

