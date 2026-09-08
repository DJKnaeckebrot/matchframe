import type { GameState, PlayerState, Side, TeamState } from "@workspace/game-state"

import {
  formatMoney,
  focusedPlayer,
  mainWeapon,
  playersForTeam,
  rosterNumber,
  weaponShortLabel,
} from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"
import { FocusedPlayer } from "./FocusedPlayer"
import { CrosshairMark, HeartMark, SkullMark } from "./hud-marks"

export function TeamView({ state }: { state: GameState }) {
  const left = state.teams[0]
  const right = state.teams[1]
  const focused = focusedPlayer(state)
  const focusedTeam = focused
    ? state.teams.find((team) => team.id === focused.teamId)
    : undefined

  return (
    <div className="flex items-end gap-3 px-5 pb-4">
      <TeamStrip
        team={left}
        players={state.players}
        observedSteamId={focused?.steamId}
      />
      <div className="flex w-[248px] shrink-0 flex-col items-center">
        {focused ? (
          <FocusedPlayer
            player={focused}
            teamName={focusedTeam?.name}
            number={rosterNumber(state.players, focused.teamId, focused.steamId)}
          />
        ) : (
          <div className="h-[268px]" />
        )}
        <p className="mt-2 text-[11px] font-semibold tracking-[0.42em] text-(--mf-text-muted)">
          MATCHFRAME
        </p>
      </div>
      <TeamStrip
        team={right}
        players={state.players}
        observedSteamId={focused?.steamId}
      />
    </div>
  )
}

function TeamStrip({
  team,
  players,
  observedSteamId,
}: {
  team: TeamState | undefined
  players: readonly PlayerState[]
  observedSteamId: string | undefined
}) {
  if (!team) {
    return <div className="min-w-0 flex-1" />
  }
  const slots = playersForTeam(players, team.id)

  return (
    <ul className="flex min-w-0 flex-1 items-end gap-1.5">
      {slots.map((player, index) => (
        <PlayerCard
          key={player?.steamId ?? `${team.id}-${index}`}
          player={player}
          side={team.side}
          number={index + 1}
          observed={player?.steamId === observedSteamId}
        />
      ))}
    </ul>
  )
}

function PlayerCard({
  player,
  side,
  number,
  observed,
}: {
  player: PlayerState | null
  side: Side
  number: number
  observed: boolean
}) {
  const accent = side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const empty = !player
  const dead = Boolean(player && !player.alive)
  const health = player?.health ?? 0
  const healthColor = health <= 20 ? "var(--mf-danger)" : accent
  const weapon = player ? mainWeapon(player) : undefined

  return (
    <li
      className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-(--mf-background)/80 ${
        empty ? "opacity-35" : dead ? "grayscale opacity-70" : ""
      } ${observed ? "outline -outline-offset-2" : ""}`}
      style={observed ? { outlineColor: accent } : undefined}
    >
      <div className="h-0.5 shrink-0" style={{ background: empty ? "transparent" : accent }} />
      <div
        className="relative h-[156px] overflow-hidden"
        style={{
          background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 42%, transparent) 0%, var(--mf-background) 52%)`,
        }}
      >
        {player ? (
          <>
            <span className="absolute inset-0 flex items-center justify-center text-[72px] leading-none font-semibold text-(--mf-text)/20 tabular-nums">
              {number}
            </span>
            <div className="absolute top-1.5 right-1.5 left-1.5 text-(--mf-text)">
              <LoadoutIcons player={player} size="sm" />
            </div>
            {weapon ? (
              <span className="absolute inset-x-1.5 bottom-1.5 flex justify-center text-(--mf-text)">
                <WeaponIcon
                  weaponId={weapon.id}
                  label={weaponShortLabel(weapon)}
                  decorative
                />
              </span>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex min-h-6 items-baseline justify-between gap-1 px-1.5 py-1">
        <span className="truncate text-[13px] font-semibold text-(--mf-text)">
          {player ? player.name || player.steamId : "—"}
        </span>
        <span
          className="flex size-5 shrink-0 items-center justify-center text-[12px] font-bold tabular-nums"
          style={{ background: empty ? "var(--mf-surface-elevated)" : accent, color: "#111418" }}
        >
          {number}
        </span>
      </div>
      <div className="flex min-h-[22px] items-center gap-1 px-1.5 pb-1">
        {player?.alive ? (
          <>
            <HeartMark />
            <span className="text-[12px] font-semibold tabular-nums">{health}</span>
            <div className="h-1.5 min-w-0 flex-1 bg-(--mf-text)/15">
              <div className="h-full" style={{ width: `${health}%`, background: healthColor }} />
            </div>
            {player.equipment.hasHelmet ? (
              <EquipmentIcon type="helmet" decorative />
            ) : player.armor > 0 ? (
              <EquipmentIcon type="armor" decorative />
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2 bg-black/35 px-1.5 py-1 text-[11px] tabular-nums text-(--mf-text-muted)">
        <span className="flex items-center gap-0.5">
          <CrosshairMark />
          {player?.kills ?? ""}
        </span>
        <span className="flex items-center gap-0.5">
          <SkullMark />
          {player?.deaths ?? ""}
        </span>
        <span className="ml-auto text-(--mf-text)">
          {player ? formatMoney(player.money) : ""}
        </span>
      </div>
    </li>
  )
}

