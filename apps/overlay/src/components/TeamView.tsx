import type { GameState, PlayerState, Side, TeamState } from "@workspace/game-state"

import { teamBroadcastName, type OverlayShow } from "../broadcast/presentation"
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
import { PlayerPortrait } from "./PlayerPortrait"

export function TeamView({ state, show }: { state: GameState; show: OverlayShow }) {
  const left = state.teams[0]
  const right = state.teams[1]
  const focused = focusedPlayer(state)

  return (
    <div className="flex items-end gap-1 px-2">
      <TeamStrip
        team={left}
        players={state.players}
        observedSteamId={focused?.steamId}
        align="left"
      />
      <div className="flex w-[468px] shrink-0 flex-col items-center">
        {show.chrome.focused && focused ? (
          <FocusedPlayer
            key={focused.steamId}
            player={focused}
            teamName={teamBroadcastName(state.teams, focused.teamId, show.broadcast)}
            number={rosterNumber(state.players, focused.teamId, focused.steamId)}
          />
        ) : (
          <div className="h-[216px]" />
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
    <ul className="flex min-w-0 flex-1 items-end">
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
  const weapon = player ? mainWeapon(player) : undefined
  const portraits = useOverlayPortraits(player, number)
  const displayName = usePlayerDisplayName(player)
  const layout = cardPortraitLayout(align)
  const mirrored = layout.mirrored

  return (
    <li
      className={`relative h-[168px] min-w-0 flex-1 overflow-hidden bg-(--mf-surface)/80 ${cardLifeClass(empty, dead)}`}
    >
      <div
        className={`absolute inset-x-0 top-0 z-(--mf-z-observer) mf-observer-mark ${
          observed && !empty ? "mf-observer-mark-on" : ""
        }`}
        style={
          empty
            ? { background: "transparent" }
            : observed
              ? undefined
              : { background: accent }
        }
      />
      {player ? (
        <>
          <PlayerPortrait portraits={portraits} className="z-(--mf-z-portrait)" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-(--mf-z-scrim) h-10 bg-linear-to-b from-(--mf-background)/80 to-transparent" />
          <div
            className={`absolute top-1.5 z-(--mf-z-chrome) drop-shadow-[0_1px_2px_rgb(12_16_20/0.95)] ${mirrored ? "right-1.5" : "left-1.5"} text-(--mf-text)`}
          >
            <LoadoutIcons player={player} size="sm" align={layout.loadoutAlign} />
          </div>
          {dead ? (
            <div className="absolute inset-x-0 bottom-0 z-(--mf-z-chrome) bg-(--mf-background)/88 px-1.5 py-2.5">
              <span className="mf-display block text-center text-[12px] tracking-[0.18em] text-(--mf-text) uppercase">
                Dead
              </span>
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 z-(--mf-z-chrome)">
              <div className="h-3 bg-linear-to-t from-(--mf-background)/88 to-transparent" />
              <div className="bg-(--mf-background)/88 px-1.5 pb-1">
                <div className={`flex items-end gap-1 ${mirrored ? "flex-row-reverse" : ""}`}>
                  <span className="mf-display min-w-0 flex-1 truncate text-[13px] leading-none font-semibold tracking-[0.04em] text-(--mf-text) uppercase">
                    {displayName}
                  </span>
                  {weapon ? (
                    <span className="mb-px shrink-0">
                      <WeaponIcon
                        weaponId={weapon.id}
                        label={weaponShortLabel(weapon)}
                        size="sm"
                        decorative
                      />
                    </span>
                  ) : null}
                </div>
                <div className={`mt-1 flex items-center gap-1 ${mirrored ? "flex-row-reverse" : ""}`}>
                  <span className="mf-display text-[11px] font-semibold tabular-nums text-(--mf-text)">
                    {health}
                  </span>
                  <div className="h-1 min-w-0 flex-1 overflow-hidden bg-(--mf-text)/25">
                    <div
                      className={mirrored ? "mf-meter-rtl" : "mf-meter"}
                      style={{
                        background: accent,
                        transform: `scaleX(${Math.min(1, Math.max(0, health / 100))})`,
                      }}
                    />
                  </div>
                  {player.equipment.hasHelmet ? (
                    <EquipmentIcon type="helmet" decorative />
                  ) : player.armor > 0 ? (
                    <EquipmentIcon type="armor" decorative />
                  ) : null}
                  <span className="mf-display shrink-0 text-[11px] tabular-nums text-(--mf-text)">
                    {formatMoney(player.money)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </li>
  )
}
