import type { GameState, MapPhase } from "@workspace/game-state"
import { defaultBroadcastConfig, overlayTeamName, seriesWinsNeeded, type BroadcastConfig } from "@workspace/presentation"

const PHASE_LABEL: Record<MapPhase, string> = {
  warmup: "Warmup",
  live: "Live",
  intermission: "Intermission",
  gameover: "Over",
  unknown: "Match",
}

export function MatchRail({
  state,
  overlay,
  serverDown,
  loading,
}: {
  state: GameState | null | undefined
  overlay: BroadcastConfig | undefined
  serverDown: boolean
  loading: boolean
}) {
  if (serverDown) {
    return (
      <div className="flex flex-col gap-1">
        <RailLamp tone="bad" label="Server unreachable" />
        <p className="text-xs text-muted-foreground">Start the stack, then refresh.</p>
      </div>
    )
  }

  if (loading && !state) {
    return <RailLamp tone="wait" label="Checking match" />
  }

  if (!state) {
    return (
      <div className="flex flex-col gap-1">
        <RailLamp tone="wait" label="Waiting for CS2" />
        <p className="text-xs text-muted-foreground">Spectator / GOTV, or send a fixture.</p>
      </div>
    )
  }

  const config = overlay
  const left = overlayTeamName(config ?? defaultBroadcastConfig, "left", state.teams[0]?.name || "Left")
  const right = overlayTeamName(config ?? defaultBroadcastConfig, "right", state.teams[1]?.name || "Right")
  const leftWins = config?.series?.leftMapsWon ?? 0
  const rightWins = config?.series?.rightMapsWon ?? 0
  const format = config?.format ?? "BO1"
  const series = seriesWinsNeeded(format) > 0 ? `${format} · ${shortMapName(state.map.name)}` : shortMapName(state.map.name)

  return (
    <div className="flex flex-col gap-2">
      <RailLamp tone="ok" label={PHASE_LABEL[state.map.phase]} />
      <p className="text-xs text-foreground">
        <span>{left}</span>
        <span className="mx-1.5 font-hud tabular-nums">
          {leftWins}-{rightWins}
        </span>
        <span>{right}</span>
      </p>
      <p className="text-xs text-muted-foreground">{series}</p>
    </div>
  )
}

function RailLamp({
  tone,
  label,
}: {
  tone: "ok" | "wait" | "bad"
  label: string
}) {
  const lamp =
    tone === "ok" ? "bg-primary" : tone === "bad" ? "bg-destructive" : "bg-muted-foreground/50"

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`size-1.5 shrink-0 ${lamp}`} aria-hidden="true" />
      {label}
    </p>
  )
}

function shortMapName(name: string): string {
  const base = name.trim().split("/").pop() ?? name
  const stripped = base.replace(/^de[_-]?/i, "").replace(/_/g, " ").trim()
  if (!stripped) {
    return name
  }
  return stripped.replace(/\b\w/g, (char) => char.toUpperCase())
}
