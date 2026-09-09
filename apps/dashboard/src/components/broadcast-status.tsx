import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { BroadcastStatus } from "@workspace/game-state"
import {
  getGsiConnectionStatus,
  gsiOperatorLabel,
  overlayConnectionLabel,
  unreachableBroadcastStatus,
} from "@workspace/game-state"
import { Button, buttonVariants } from "@workspace/ui/components/button"

import { fetchBroadcastStatus, overlayPublicUrl } from "@/lib/api.ts"

export function useBroadcastStatus() {
  return useQuery({
    queryKey: ["broadcast-status"],
    queryFn: fetchBroadcastStatus,
    retry: 8,
    retryDelay: 400,
    refetchInterval: 1000,
  })
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function resolvedBroadcastStatus(
  data: BroadcastStatus | undefined,
  isError: boolean,
  isPending: boolean
): BroadcastStatus | undefined {
  if (isError) {
    return unreachableBroadcastStatus()
  }
  if (isPending && !data) {
    return undefined
  }
  return data
}

export function StatusLamp({
  tone,
  label,
}: {
  tone: "ok" | "wait" | "warn" | "bad"
  label: string
}) {
  const lamp =
    tone === "ok"
      ? "bg-success"
      : tone === "bad"
        ? "bg-destructive"
        : tone === "warn"
          ? "bg-primary"
          : "bg-muted-foreground/50"

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-1.5 shrink-0 ${lamp}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export function gsiLampTone(freshness: BroadcastStatus["gsi"]["freshness"]): "ok" | "wait" | "warn" | "bad" {
  if (freshness === "live") {
    return "ok"
  }
  if (freshness === "stale") {
    return "warn"
  }
  if (freshness === "offline") {
    return "bad"
  }
  return "wait"
}

export function overlayLampTone(connectedClients: number): "ok" | "wait" {
  return connectedClients > 0 ? "ok" : "wait"
}

export function readinessLampTone(state: BroadcastStatus["readiness"]["state"]): "ok" | "wait" | "warn" | "bad" {
  if (state === "ready") {
    return "ok"
  }
  if (state === "warning") {
    return "warn"
  }
  return "bad"
}

export function radarLampTone(radar: BroadcastStatus["match"]["radar"]): "ok" | "wait" | "warn" {
  if (radar === "ready") {
    return "ok"
  }
  if (radar === "unavailable") {
    return "warn"
  }
  return "wait"
}

export function BroadcastStatusLamps({ status }: { status: BroadcastStatus }) {
  const now = useNow()
  const gsi = getGsiConnectionStatus(status.gsi.lastUpdateAt, now)
  const radarLabel =
    status.match.radar === "ready"
      ? "Radar ready"
      : status.match.radar === "unavailable"
        ? "Radar unavailable"
        : "Radar —"

  return (
    <div
      role="status"
      className="flex flex-wrap items-baseline gap-x-5 gap-y-2 font-hud text-xs tracking-wide text-muted-foreground"
    >
      <StatusLamp
        tone={status.server.healthy ? "ok" : "bad"}
        label={`Server ${status.server.healthy ? "Up" : "Down"}`}
      />
      <StatusLamp tone={gsiLampTone(gsi.freshness)} label={`CS2 ${gsiOperatorLabel(gsi, now, status.gsi.lastUpdateAt)}`} />
      <StatusLamp
        tone={overlayLampTone(status.overlay.connectedClients)}
        label={`Overlay ${overlayConnectionLabel(status.overlay.connectedClients)}`}
      />
      <StatusLamp tone={radarLampTone(status.match.radar)} label={radarLabel} />
    </div>
  )
}

export function BroadcastStatusStrip({ status }: { status: BroadcastStatus }) {
  const now = useNow()
  const gsi = getGsiConnectionStatus(status.gsi.lastUpdateAt, now)
  const overlayUrl = overlayPublicUrl()
  const issues = status.readiness.issues

  return (
    <section className="flex flex-col gap-3 border-b border-border pb-4" aria-label="Broadcast status">
      <div
        role="status"
        className="flex flex-wrap items-baseline gap-x-5 gap-y-2 font-hud text-xs tracking-wide text-muted-foreground"
      >
        <StatusLamp tone={gsiLampTone(gsi.freshness)} label={`CS2 ${gsiOperatorLabel(gsi, now, status.gsi.lastUpdateAt)}`} />
        <StatusLamp
          tone={overlayLampTone(status.overlay.connectedClients)}
          label={`Overlay ${overlayConnectionLabel(status.overlay.connectedClients)}`}
        />
        {status.match.map && status.match.round !== undefined ? (
          <span className="text-foreground">
            {status.match.map} · R{status.match.round}
          </span>
        ) : null}
        {status.gsi.freshness !== "waiting" ? (
          <span>
            {status.match.playerCount} {status.match.playerCount === 1 ? "player" : "players"}
          </span>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li
              key={issue.code}
              className={`border-l-2 pl-3 ${
                issue.code === "server_unreachable" ? "border-destructive" : "border-primary"
              }`}
            >
              <p className="text-sm text-foreground">{issue.title}</p>
              <p className="text-sm text-muted-foreground">{issue.detail}</p>
            </li>
          ))}
        </ul>
      ) : status.match.radar === "ready" ? (
        <p className="text-sm text-muted-foreground">Radar ready</p>
      ) : null}

      <OverlayUrlControls url={overlayUrl} />
    </section>
  )
}

export function OverlayUrlControls({
  url,
  copyLabel = "Copy",
  openLabel = "Open",
}: {
  url: string
  copyLabel?: string
  openLabel?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Overlay URL</p>
        <p className="truncate font-hud text-sm text-foreground">{url}</p>
        <p className="text-xs text-muted-foreground">Browser Source · 1920×1080</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()} aria-live="polite">
          {copied ? "Copied" : copyLabel}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {openLabel}
        </a>
      </div>
    </div>
  )
}
