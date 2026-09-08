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
import { cardLifeClass, cardPortraitLayout } from "../portraits/card-layout"
import { useOverlayPortraits, usePlayerDisplayName } from "../portraits/use-portrait"
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
  const portraits = useOverlayPortraits(player, number)
  const displayName = usePlayerDisplayName(player)
  const layout = cardPortraitLayout(align)
  const mirrored = layout.mirrored

  return (
    <li
      className={`relative flex min-w-0 flex-1 flex-col overflow-hidden bg-(--mf-background)/70 ${cardLifeClass(empty, dead)}`}
    >
      <div className="h-0.5 shrink-0" style={{ background: empty ? "transparent" : accent }} />
      {empty ? null : (
        <div
          className={`absolute inset-y-0.5 z-30 w-0.5 ${mirrored ? "right-0" : "left-0"}`}
          style={{ background: accent }}
        />
      )}
      <div className="relative h-[128px] overflow-hidden bg-(--mf-surface-elevated)/80">
        {player ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background: mirrored
                  ? `linear-gradient(to left, color-mix(in srgb, ${accent} 9%, transparent), transparent 52%)`
                  : `linear-gradient(to right, color-mix(in srgb, ${accent} 9%, transparent), transparent 52%)`,
              }}
            />
            <PlayerPortrait portraits={portraits} className="z-[1]" />
            <div className={`absolute top-1 z-20 ${mirrored ? "right-1.5" : "left-1.5"} text-(--mf-text)`}>
              <LoadoutIcons player={player} size="sm" align={layout.loadoutAlign} />
            </div>
            {weapon ? (
              <span
                className={`absolute bottom-0.5 z-20 opacity-85 ${mirrored ? "left-1.5" : "right-1.5"}`}
              >
                <WeaponIcon
                  weaponId={weapon.id}
                  label={weaponShortLabel(weapon)}
                  size="sm"
                  decorative
                />
              </span>
            ) : null}
          </>
        ) : null}
      </div>
      <div
        className="relative z-10 bg-(--mf-surface)/94 px-1.5 py-1"
        style={
          observed ? { boxShadow: `inset 0 1px 0 ${accent}` } : undefined
        }
      >
        <div className={`flex min-h-5 items-center ${mirrored ? "flex-row-reverse" : ""}`}>
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-(--mf-text)">
            {displayName}
          </span>
        </div>
        <div className="mt-0.5 flex min-h-4 items-center gap-1">
          {player?.alive ? (
            <>
              <HeartMark />
              <span className="text-[11px] font-semibold tabular-nums">{health}</span>
              <div className="h-1 min-w-0 flex-1 bg-(--mf-text)/15">
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
        <div className="mt-0.5 flex items-center gap-2 text-[10px] tabular-nums text-(--mf-text-muted)">
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
      </div>
    </li>
  )
}
