import type { BroadcastStatus } from "@workspace/game-state"
import { matchContextLine, matchScoreLine, sidebarReadinessLabel } from "@workspace/game-state"

import { readinessLampTone, StatusLamp } from "@/components/broadcast-status.tsx"

export function MatchRail({
  status,
  loading,
}: {
  status: BroadcastStatus | undefined
  loading: boolean
}) {
  if (loading && !status) {
    return <StatusLamp tone="wait" label="Checking" />
  }

  if (!status) {
    return <StatusLamp tone="wait" label="Checking" />
  }

  const label = sidebarReadinessLabel(status)
  const score = matchScoreLine(status.match)
  const context = matchContextLine(status.match)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Broadcast</p>
      <p className="font-hud text-xs tracking-wide text-foreground">
        <StatusLamp tone={readinessLampTone(status.readiness.state)} label={label} />
      </p>
      {score ? <p className="text-xs text-foreground">{score}</p> : null}
      {context ? <p className="text-xs text-muted-foreground">{context}</p> : null}
    </div>
  )
}
