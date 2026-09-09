import { type CSSProperties } from "react"
import { themeToCssVars } from "@workspace/theme"

import { applyBroadcastConfig, overlayShow, parseOverlayBranding } from "../broadcast/presentation"
import { useRealtimeStore } from "../realtime/store"
import { ConnectionIndicator } from "./ConnectionIndicator"
import { Radar } from "./Radar"
import { RoundHistory } from "./RoundHistory"
import { Scoreboard } from "./Scoreboard"
import { TeamView } from "./TeamView"

export function Overlay() {
  const state = useRealtimeStore((store) => store.state)
  const theme = useRealtimeStore((store) => store.theme)
  const overlay = useRealtimeStore((store) => store.broadcastConfig)
  const search = typeof window === "undefined" ? "" : window.location.search
  const branding = applyBroadcastConfig(parseOverlayBranding(search), overlay)
  const show = state ? overlayShow(state, branding, overlay) : null
  const preview = new URLSearchParams(search).has("preview")

  return (
    <div
      className="pointer-events-none relative h-full w-full overflow-hidden text-(--mf-text)"
      style={{
        ...(themeToCssVars(theme) as CSSProperties),
        ...(preview ? { background: "var(--mf-background)" } : {}),
      }}
      data-overlay-phase={show?.phase}
    >
      <ConnectionIndicator />
      {state && show ? (
        <>
          {show.chrome.radar ? <Radar state={state} /> : null}
          {show.chrome.header ? (
            <div className="absolute top-6 right-0 left-0 flex justify-center">
              <div className="w-[1040px]">
                <Scoreboard state={state} show={show} />
                <RoundHistory state={state} visible={show.chrome.history} />
              </div>
            </div>
          ) : null}
          {show.chrome.teams ? (
            <div className="absolute inset-x-0 bottom-0">
              <TeamView state={state} show={show} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
