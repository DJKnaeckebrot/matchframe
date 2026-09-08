import type { PlayerState } from "@workspace/game-state"

import { EquipmentIcon } from "./equipment-icon"
import type { IconSize } from "./icon-types"
import { ObjectiveIcon } from "./objective-icon"
import { UtilityIcon } from "./utility-icon"

export function LoadoutIcons({
  player,
  align,
  size = "sm",
}: {
  player: PlayerState
  align?: "left" | "right"
  size?: IconSize
}) {
  const empty =
    player.equipment.grenades.length === 0 &&
    !player.equipment.hasBomb &&
    !player.equipment.hasDefuseKit
  if (empty) {
    return null
  }

  return (
    <span
      className={`flex items-end gap-1.5 ${align === "right" ? "justify-end" : ""}`}
    >
      {player.equipment.grenades.map((grenade) => (
        <UtilityIcon
          key={grenade.id}
          utilityId={grenade.id}
          count={grenade.count}
          size={size}
        />
      ))}
      {player.equipment.hasBomb ? (
        <span className="text-(--mf-t)">
          <ObjectiveIcon type="bomb" size={size} />
        </span>
      ) : null}
      {player.equipment.hasDefuseKit ? (
        <span className="text-(--mf-ct)">
          <EquipmentIcon type="defuse" size={size} />
        </span>
      ) : null}
    </span>
  )
}
