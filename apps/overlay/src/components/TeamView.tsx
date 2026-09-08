import type { GameState, PlayerState, Side, TeamState } from "@workspace/game-state"

import type { OverlayShow } from "../broadcast/presentation"
import {
  formatMoney,
  focusedPlayer,
  mainWeapon,
  playersForTeam,
  rosterNumber,
  weaponShortLabel,
} from "../hud/format"
import { EquipmentIcon, LoadoutIcons, WeaponIcon } from "../icons"
import { useOverlayPortrait, usePlayerDisplayName } from "../portraits/use-portrait"
import { FocusedPlayer } from "./FocusedPlayer"
import { CrosshairMark, HeartMark, SkullMark } from "./hud-marks"
import { InterstitialCard } from "./InterstitialCard"
import { PlayerPortrait } from "./PlayerPortrait"

export function TeamView({ state, show }: { state: GameState; show: OverlayShow }) {
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
        align="left"
      />
      <div className="flex w-[248px] shrink-0 flex-col items-center">
        {show.chrome.interstitial && show.interstitial ? (
          <InterstitialCard card={show.interstitial} />
        ) : show.chrome.focused && focused ? (
          <FocusedPlayer
            player={focused}
            teamName={focusedTeam?.name}
            number={rosterNumber(state.players, focused.teamId, focused.steamId)}
          />
        ) : (
          <div className="h-[220px]" />
        )}
      </div>
      <TeamStrip
        team={right}
        players={state.players}
        observedSteamId={focused?.steamId}
        align="right"
      />
    </div>
  )
}

function TeamStrip({
  team,
  players,
  observedSteamId,
  align,
}: {
  team: TeamState | undefined
  players: readonly PlayerState[]
  observedSteamId: string | undefined
  align: "left" | "right"
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
          align={align}
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
  align,
}: {
  player: PlayerState | null
  side: Side
  number: number
  observed: boolean
  align: "left" | "right"
}) {
  const accent = side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const empty = !player
  const dead = Boolean(player && !player.alive)
  const health = player?.health ?? 0
  const healthColor = health <= 20 ? "var(--mf-danger)" : accent
  const weapon = player ? mainWeapon(player) : undefined
  const portrait = useOverlayPortrait(player, number)
  const displayName = usePlayerDisplayName(player)
  const mirrored = align === "right"

  return (
    <li
      className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-(--mf-background)/80 ${
        empty ? "opacity-35" : dead ? "grayscale opacity-70" : ""
      }`}
    >
      <div className="h-0.5 shrink-0" style={{ background: empty ? "transparent" : accent }} />
      <div
        className="relative h-[128px] overflow-hidden"
        style={{
          background: empty
            ? "transparent"
            : `color-mix(in srgb, ${accent} 20%, var(--mf-background))`,
        }}
      >
        {player ? (
          <>
            <PlayerPortrait portrait={portrait} accent={accent} className="absolute inset-0 z-0" />
            <div className={`absolute top-1.5 z-10 ${mirrored ? "right-1.5" : "left-1.5"} text-(--mf-text)`}>
              <LoadoutIcons player={player} size="sm" align={mirrored ? "right" : "left"} />
            </div>
            {weapon ? (
              <span className="absolute inset-x-0 bottom-0 z-10 flex h-6 items-center justify-center bg-black/35 text-(--mf-text)">
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
      <div
        className={`flex min-h-7 items-center px-1.5 py-1 ${mirrored ? "flex-row-reverse" : ""}`}
        style={
          observed
            ? { background: `color-mix(in srgb, ${accent} 40%, var(--mf-surface))` }
            : undefined
        }
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-(--mf-text)">
          {displayName}
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
        ) : player ? (
          <span className="text-[10px] tracking-[0.14em] text-(--mf-text-muted) uppercase">Dead</span>
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
