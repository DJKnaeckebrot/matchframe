import { SHOW_DIAGNOSTICS } from "../hud/diagnostics"
import { useRealtimeStore } from "../realtime/store"

function statusLabel(wsStatus: string, hasState: boolean): string {
  if (wsStatus !== "connected") {
    return wsStatus === "connecting" ? "Connecting" : "Server offline"
  }
  return hasState ? "" : "Waiting for CS2"
}

export function ConnectionIndicator() {
  const wsStatus = useRealtimeStore((store) => store.wsStatus)
  const state = useRealtimeStore((store) => store.state)

  if (!SHOW_DIAGNOSTICS) {
    return null
  }

  const label = statusLabel(wsStatus, state !== null)
  if (!label) {
    return null
  }

  return (
    <div className="pointer-events-none absolute top-8 right-8 z-(--mf-z-diagnostics) flex items-center gap-2 text-[11px] tracking-[0.18em] text-(--mf-text-muted) uppercase">
      <span
        className="size-1.5 rounded-full bg-(--mf-accent)"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  )
}
