import type { CSSProperties } from "react"
import { themeToCssVars } from "@workspace/theme"

import { focusedPlayer } from "../hud/format"
import { useRealtimeStore } from "../realtime/store"
import { ConnectionIndicator } from "./ConnectionIndicator"
import { FocusedPlayer } from "./FocusedPlayer"
import { PlayerList } from "./PlayerList"
import { Scoreboard } from "./Scoreboard"

export function Overlay() {
  const state = useRealtimeStore((store) => store.state)
  const theme = useRealtimeStore((store) => store.theme)
  const left = state?.teams[0]
  const right = state?.teams[1]
  const focused = state ? focusedPlayer(state) : null

  return (
    <div
      className="pointer-events-none relative h-full w-full overflow-hidden text-(--mf-text)"
      style={themeToCssVars(theme) as CSSProperties}
    >
      <ConnectionIndicator />
      {state ? (
        <>
          <div className="absolute top-8 right-0 left-0 flex justify-center">
            <div className="w-[1040px]">
              <Scoreboard state={state} />
            </div>
          </div>
          {left ? (
            <div className="absolute bottom-12 left-8">
              <PlayerList team={left} players={state.players} align="left" />
            </div>
          ) : null}
          {right ? (
            <div className="absolute right-8 bottom-12">
              <PlayerList team={right} players={state.players} align="right" />
            </div>
          ) : null}
          {focused ? (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
              <FocusedPlayer player={focused} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
