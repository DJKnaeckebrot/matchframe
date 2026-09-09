import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  compactOverlayConfig,
  overlayTeamName,
  SERIES_LABELS,
  seriesWinsNeeded,
  type OverlayConfig,
  type SeriesLabel,
} from "@workspace/presentation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { PageStatus } from "@/components/page-status.tsx"
import { Pulse } from "@/components/pulse.tsx"
import { fetchGameState, fetchOverlayConfig, saveOverlayConfig } from "@/lib/api.ts"

const SERIES_COPY: Record<SeriesLabel, string> = {
  BO1: "One map",
  BO3: "First to 2",
  BO5: "First to 3",
  BO7: "First to 4",
}

export function OverlayPage() {
  const queryClient = useQueryClient()
  const overlayQuery = useQuery({
    queryKey: ["overlay-config"],
    queryFn: fetchOverlayConfig,
    retry: 8,
    retryDelay: 400,
  })
  const stateQuery = useQuery({
    queryKey: ["game-state"],
    queryFn: fetchGameState,
    retry: 8,
    retryDelay: 400,
    refetchInterval: 1000,
  })
  const mutation = useMutation({
    mutationFn: saveOverlayConfig,
    onSuccess: (overlay) => {
      queryClient.setQueryData(["overlay-config"], overlay)
      void queryClient.invalidateQueries({ queryKey: ["game-state"] })
    },
  })

  const selected = overlayQuery.data?.series
  const leftLive = stateQuery.data?.teams[0]?.name
  const rightLive = stateQuery.data?.teams[1]?.name
  const [leftName, setLeftName] = useState("")
  const [rightName, setRightName] = useState("")

  useEffect(() => {
    setLeftName(overlayQuery.data?.leftName ?? "")
    setRightName(overlayQuery.data?.rightName ?? "")
  }, [overlayQuery.data])

  const status = useMemo(() => {
    if (overlayQuery.isError) {
      return "Could not load overlay settings. Is the server running?"
    }
    if (mutation.isError) {
      return "Could not apply overlay settings."
    }
    if (mutation.isSuccess) {
      return "Applied to the live overlay."
    }
    return null
  }, [overlayQuery.isError, mutation.isError, mutation.isSuccess])

  const winsNeeded = selected ? seriesWinsNeeded(selected) : 0
  const leftWins = stateQuery.data?.teams[0]?.seriesWins ?? overlayQuery.data?.leftWins ?? 0
  const rightWins = stateQuery.data?.teams[1]?.seriesWins ?? overlayQuery.data?.rightWins ?? 0
  const leftLabel = overlayTeamName(
    { leftName, rightName },
    "left",
    leftLive || "Left"
  )
  const rightLabel = overlayTeamName(
    { leftName, rightName },
    "right",
    rightLive || "Right"
  )

  function save(next: OverlayConfig) {
    mutation.mutate(compactOverlayConfig(next))
  }

  function config(overrides: Partial<OverlayConfig> = {}): OverlayConfig {
    const overlay = overlayQuery.data
    return {
      series: selected ?? "BO1",
      leftName,
      rightName,
      ...(overlay?.leftWins !== undefined ? { leftWins: overlay.leftWins } : {}),
      ...(overlay?.rightWins !== undefined ? { rightWins: overlay.rightWins } : {}),
      ...overrides,
    }
  }

  const statusTone = overlayQuery.isError || mutation.isError ? "bad" : mutation.isSuccess ? "ok" : "muted"

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-hud text-xl font-semibold tracking-wide">Overlay</h1>
        <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          Best of and team names for tonight. The HUD updates immediately. No OBS reload.
        </p>
      </header>

      {overlayQuery.isLoading ? (
        <OverlaySkeleton />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Best of</h2>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Best of"
            >
              {SERIES_LABELS.map((series) => {
                const active = selected === series
                return (
                  <button
                    key={series}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (selected !== series) {
                        save(config({ series }))
                      }
                    }}
                    className={`flex flex-col gap-3 border px-3 py-4 text-left ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span className="font-hud text-sm tracking-wide">{series}</span>
                    <span className="text-sm font-medium text-inherit">{SERIES_COPY[series]}</span>
                    <SeriesMarks series={series} active={active} />
                  </button>
                )
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Teams</h2>
            <p className="text-sm text-muted-foreground">
              Left and right stay put at half-time. Blank uses the in-game name.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TeamNameField
                id="overlay-left-name"
                label="Left"
                value={leftName}
                placeholder={leftLive || "In-game name"}
                disabled={mutation.isPending}
                onChange={setLeftName}
                onCommit={() => {
                  if (leftName.trim() === (overlayQuery.data?.leftName ?? "")) {
                    return
                  }
                  save(config())
                }}
              />
              <TeamNameField
                id="overlay-right-name"
                label="Right"
                value={rightName}
                placeholder={rightLive || "In-game name"}
                disabled={mutation.isPending}
                onChange={setRightName}
                onCommit={() => {
                  if (rightName.trim() === (overlayQuery.data?.rightName ?? "")) {
                    return
                  }
                  save(config())
                }}
              />
            </div>
          </section>

          {winsNeeded > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">Maps won</h2>
                {leftWins > 0 || rightWins > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => save(config({ leftWins: 0, rightWins: 0 }))}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Auto-fills from the match. Click a mark to correct it.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MapWinsField
                  label={leftLabel}
                  wins={leftWins}
                  max={winsNeeded}
                  disabled={mutation.isPending}
                  onChange={(wins) => save(config({ leftWins: wins, rightWins }))}
                />
                <MapWinsField
                  label={rightLabel}
                  wins={rightWins}
                  max={winsNeeded}
                  disabled={mutation.isPending}
                  onChange={(wins) => save(config({ leftWins, rightWins: wins }))}
                />
              </div>
            </section>
          ) : null}
        </>
      )}

      {status ? <PageStatus tone={statusTone}>{status}</PageStatus> : null}
    </div>
  )
}

function OverlaySkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Pulse className="h-28" />
        <Pulse className="h-28" />
        <Pulse className="h-28" />
        <Pulse className="h-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Pulse className="h-16" />
        <Pulse className="h-16" />
      </div>
    </div>
  )
}

function TeamNameField({
  id,
  label,
  value,
  placeholder,
  disabled,
  onChange,
  onCommit,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  disabled: boolean
  onChange: (value: string) => void
  onCommit: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={32}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

function MapWinsField({
  label,
  wins,
  max,
  disabled,
  onChange,
}: {
  label: string
  wins: number
  max: number
  disabled: boolean
  onChange: (wins: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {wins} / {max}
        </p>
      </div>
      <div className="flex gap-1" role="group" aria-label={`${label} maps won`}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < wins
          const value = index + 1
          return (
            <button
              key={index}
              type="button"
              aria-pressed={filled}
              aria-label={`${value} ${value === 1 ? "map" : "maps"}`}
              disabled={disabled}
              onClick={() => onChange(wins === value ? index : value)}
              className="flex h-11 min-w-11 flex-1 items-center justify-center border border-border hover:border-primary/50 disabled:opacity-50"
            >
              <span
                className="h-1 w-6"
                style={{
                  background: filled
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--foreground) 22%, transparent)",
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SeriesMarks({ series, active }: { series: SeriesLabel; active: boolean }) {
  const winsNeeded = seriesWinsNeeded(series)
  if (winsNeeded === 0) {
    return <span className="text-xs text-muted-foreground">No map marks</span>
  }
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: winsNeeded }, (_, index) => (
        <span
          key={index}
          className="h-[3px] w-3.5"
          style={{
            background: active
              ? "currentColor"
              : "color-mix(in srgb, currentColor 35%, transparent)",
          }}
        />
      ))}
    </span>
  )
}
