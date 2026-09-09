import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { BroadcastStatus } from "@workspace/game-state"
import {
  getGsiConnectionStatus,
  gsiOperatorLabel,
  overlayConnectionLabel,
} from "@workspace/game-state"
import { Button, buttonVariants } from "@workspace/ui/components/button"

import {
  BroadcastStatusLamps,
  OverlayUrlControls,
  gsiLampTone,
  resolvedBroadcastStatus,
  StatusLamp,
  useBroadcastStatus,
  useNow,
} from "@/components/broadcast-status.tsx"
import { PageStatus } from "@/components/page-status.tsx"
import { Pulse } from "@/components/pulse.tsx"
import {
  InstallGsiError,
  fetchSetupStatus,
  installGsiConfig,
  openGsiFolder,
  overlayPublicUrl,
  resetMatchState,
  setupCfgDownloadUrl,
} from "@/lib/api.ts"
import type { GsiInstallStatus, SetupStatus } from "@/lib/setup.ts"

export function SetupPage() {
  const queryClient = useQueryClient()
  const statusQuery = useBroadcastStatus()
  const setupQuery = useQuery({
    queryKey: ["setup-status"],
    queryFn: fetchSetupStatus,
    retry: 8,
    retryDelay: 400,
    refetchInterval: 2000,
  })
  const status = resolvedBroadcastStatus(statusQuery.data, statusQuery.isError, statusQuery.isPending)
  const [confirmReset, setConfirmReset] = useState(false)
  const [installNote, setInstallNote] = useState<string | null>(null)

  const install = useMutation({
    mutationFn: installGsiConfig,
    onSuccess: (result) => {
      queryClient.setQueryData(["setup-status"], result.setup)
      setInstallNote("GSI configuration installed. Restart CS2 before testing the integration.")
    },
    onError: (error) => {
      if (error instanceof InstallGsiError) {
        queryClient.setQueryData(["setup-status"], error.setup)
      }
    },
  })

  const openFolder = useMutation({
    mutationFn: openGsiFolder,
  })

  const reset = useMutation({
    mutationFn: resetMatchState,
    onSuccess: () => {
      setConfirmReset(false)
      void queryClient.invalidateQueries({ queryKey: ["broadcast-status"] })
      void queryClient.invalidateQueries({ queryKey: ["game-state"] })
    },
  })

  useEffect(() => {
    if (!confirmReset) {
      return
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmReset(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [confirmReset])

  if (setupQuery.isPending && !setupQuery.data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <SetupHeader />
        <Pulse className="h-24" />
      </div>
    )
  }

  const setup = setupQuery.data
  const headline = setup && status ? setupHeadline(setup, status) : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <SetupHeader />

      {status ? <BroadcastStatusLamps status={status} /> : null}

      {headline ? (
        <div>
          <p className="font-hud text-sm tracking-wide text-foreground">{headline.label}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {headline.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {setupQuery.isError ? (
        <PageStatus tone="bad">Could not load setup. Is the server running?</PageStatus>
      ) : null}
      {install.isError && !(install.error instanceof InstallGsiError) ? (
        <PageStatus tone="bad">Could not install the GSI configuration.</PageStatus>
      ) : null}
      {openFolder.isError ? <PageStatus tone="bad">Could not open the CS2 cfg folder.</PageStatus> : null}
      {reset.isError ? <PageStatus tone="bad">Could not reset match state.</PageStatus> : null}
      {installNote ? <PageStatus tone="ok">{installNote}</PageStatus> : null}

      {setup ? (
        <Cs2Section
          setup={setup}
          status={status}
          installing={install.isPending}
          opening={openFolder.isPending}
          onInstall={() => {
            setInstallNote(null)
            install.mutate()
          }}
          onOpenFolder={() => openFolder.mutate()}
        />
      ) : null}

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-sm font-medium">OBS Overlay</h2>
        <p className="text-sm text-muted-foreground">
          Create an OBS Browser Source using this URL at 1920×1080.
        </p>
        <OverlayUrlControls url={overlayPublicUrl()} copyLabel="Copy URL" openLabel="Open Overlay" />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-sm font-medium">Match Control</h2>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Clears the current CS2 state, score, players, killfeed and round tracking.
          Broadcast configuration and assets are kept.
        </p>
        {confirmReset ? (
          <div
            role="alertdialog"
            aria-labelledby="reset-title"
            aria-describedby="reset-detail"
            className="flex flex-col gap-3 border-l-2 border-destructive pl-3"
          >
            <p id="reset-title" className="text-sm text-foreground">
              Reset match state?
            </p>
            <p id="reset-detail" className="text-sm text-muted-foreground">
              This clears the current CS2 state, score, players, killfeed and round tracking.
              Broadcast configuration and assets are kept.
            </p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={reset.isPending}
                onClick={() => reset.mutate()}
              >
                Reset match
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
              Reset match state
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

function SetupHeader() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-hud text-xl font-semibold tracking-wide">Setup</h1>
      <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
        CS2 integration, OBS browser source, and match reset. Local to this machine.
      </p>
    </header>
  )
}

function Cs2Section({
  setup,
  status,
  installing,
  opening,
  onInstall,
  onOpenFolder,
}: {
  setup: SetupStatus
  status: BroadcastStatus | undefined
  installing: boolean
  opening: boolean
  onInstall: () => void
  onOpenFolder: () => void
}) {
  const now = useNow()
  const gsi = status ? getGsiConnectionStatus(status.gsi.lastUpdateAt, now) : null
  const install = setup.cs2.gsi
  const path = gsiPath(install)
  const canInstall = install.state === "not-installed" || install.state === "outdated"
  const showManual = install.state === "not-installed" || install.state === "cs2-not-found" || install.state === "unsupported"

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-sm font-medium">CS2 Integration</h2>
      <p className="font-hud text-xs tracking-wide text-muted-foreground">
        <StatusLamp tone={installLampTone(install)} label={installLabel(install)} />
      </p>
      {path ? <p className="break-all font-mono text-xs text-muted-foreground">{path}</p> : null}
      {gsi ? (
        <p className="font-hud text-xs tracking-wide text-muted-foreground">
          <StatusLamp
            tone={gsiLampTone(gsi.freshness)}
            label={gsiFeedLabel(gsi.freshness, gsiOperatorLabel(gsi, now, status?.gsi.lastUpdateAt))}
          />
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        {canInstall ? (
          <Button type="button" size="sm" disabled={installing} onClick={onInstall}>
            {install.state === "outdated" ? "Update" : "Install"}
          </Button>
        ) : null}
        {setup.canOpenFolder ? (
          <Button type="button" variant="outline" size="sm" disabled={opening} onClick={onOpenFolder}>
            Open folder
          </Button>
        ) : null}
        <a
          href={setupCfgDownloadUrl()}
          download="gamestate_integration_matchframe.cfg"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Download config
        </a>
      </div>

      {showManual ? <ManualFallback /> : null}
    </section>
  )
}

function ManualFallback() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
      <li>Locate the CS2 cfg directory</li>
      <li>Copy gamestate_integration_matchframe.cfg into it</li>
      <li>Restart CS2</li>
    </ol>
  )
}

function setupHeadline(
  setup: SetupStatus,
  status: BroadcastStatus
): { label: string; lines: string[] } {
  const gsi = setup.cs2.gsi
  if (gsi.state === "not-installed" || gsi.state === "cs2-not-found" || gsi.state === "unsupported") {
    return {
      label: "SETUP NEEDED",
      lines: [
        gsi.state === "not-installed"
          ? "CS2 integration not installed"
          : gsi.state === "unsupported"
            ? gsi.reason
            : "CS2 installation not found",
      ],
    }
  }
  if (gsi.state === "outdated") {
    return { label: "UPDATE AVAILABLE", lines: ["CS2 integration needs update"] }
  }
  const live = status.gsi.freshness === "live"
  const overlay = status.overlay.connectedClients > 0
  if (live && overlay) {
    return {
      label: "READY",
      lines: ["CS2 integration installed", "CS2 data live", overlayConnectionLabel(status.overlay.connectedClients) === "Connected" ? "Overlay connected" : `Overlay ${overlayConnectionLabel(status.overlay.connectedClients).toLowerCase()}`],
    }
  }
  return {
    label: "WAITING",
    lines: [
      "CS2 integration installed",
      live ? "CS2 data live" : "Waiting for CS2",
      overlay ? "Overlay connected" : "Overlay not connected",
    ],
  }
}

function installLabel(install: GsiInstallStatus): string {
  if (install.state === "installed") {
    return "Installed"
  }
  if (install.state === "outdated") {
    return "Needs update"
  }
  if (install.state === "not-installed") {
    return "Not installed"
  }
  if (install.state === "unsupported") {
    return "Unavailable"
  }
  return "Not installed"
}

function installLampTone(install: GsiInstallStatus): "ok" | "wait" | "warn" | "bad" {
  if (install.state === "installed") {
    return "ok"
  }
  if (install.state === "outdated") {
    return "warn"
  }
  return "wait"
}

function gsiPath(install: GsiInstallStatus): string | undefined {
  if (install.state === "installed" || install.state === "outdated") {
    return install.path
  }
  if (install.state === "not-installed") {
    return install.targetPath
  }
  return undefined
}

function gsiFeedLabel(
  freshness: BroadcastStatus["gsi"]["freshness"],
  operator: string
): string {
  if (freshness === "live") {
    return "Receiving data"
  }
  if (freshness === "stale") {
    return operator
  }
  if (freshness === "offline") {
    return operator
  }
  return "Waiting for CS2"
}
