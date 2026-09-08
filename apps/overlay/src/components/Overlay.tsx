import type { CSSProperties } from "react"
import { themeToCssVars } from "@workspace/theme"

import { useRealtimeStore } from "../realtime/store"
import { ConnectionIndicator } from "./ConnectionIndicator"
import { Radar } from "./Radar"
import { Scoreboard } from "./Scoreboard"
import { TeamView } from "./TeamView"

export function Overlay() {
  const state = useRealtimeStore((store) => store.state)
  const theme = useRealtimeStore((store) => store.theme)

  return (
    <div
      className="pointer-events-none relative h-full w-full overflow-hidden text-(--mf-text)"
      style={themeToCssVars(theme) as CSSProperties}
    >
      <ConnectionIndicator />
      {state ? (
        <>
          <Radar state={state} />
          <div className="absolute top-8 right-0 left-0 flex justify-center">
            <div className="w-[1040px]">
              <Scoreboard state={state} />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0">
            <TeamView state={state} />
          </div>
        </>
      ) : null}
    </div>
  )
}
