import type { PlayerState, TeamState } from "@workspace/game-state"

import { playersForTeam } from "../hud/format"
import { PlayerRow } from "./PlayerRow"

export function PlayerList({
  team,
  players,
  align,
}: {
  team: TeamState
  players: readonly PlayerState[]
  align: "left" | "right"
}) {
  const slots = playersForTeam(players, team.id)

  return (
    <section className="w-[528px]">
      <ul className="flex flex-col gap-1.5">
        {slots.map((player, index) => (
          <PlayerRow
            key={player?.steamId ?? `${team.id}-${index}`}
            player={player}
            side={team.side}
            align={align}
          />
        ))}
      </ul>
    </section>
  )
}
