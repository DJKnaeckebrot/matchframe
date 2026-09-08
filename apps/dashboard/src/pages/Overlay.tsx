import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  compactOverlayConfig,
  SERIES_LABELS,
  type OverlayConfig,
  type SeriesLabel,
} from "@workspace/presentation"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

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

  function save(next: OverlayConfig) {
    mutation.mutate(compactOverlayConfig(next))
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Overlay</h1>
        <p className="text-sm text-muted-foreground">
          Best of and team names for tonight. The HUD updates immediately — no OBS reload.
        </p>
      </header>

      {overlayQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading overlay settings…</p>
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
                        save({ series, leftName, rightName })
                      }
                    }}
                    className={`flex flex-col gap-3 border px-3 py-4 text-left transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-[11px] tracking-[0.22em]">{series}</span>
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
                  save({ series: selected ?? "BO1", leftName, rightName })
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
                  save({ series: selected ?? "BO1", leftName, rightName })
                }}
              />
            </div>
          </section>
        </>
      )}

      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
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

function SeriesMarks({ series, active }: { series: SeriesLabel; active: boolean }) {
  const winsNeeded = series === "BO1" ? 0 : (Number(series.slice(2)) + 1) / 2
  if (winsNeeded === 0) {
    return <span className="text-[11px] tracking-[0.14em] uppercase">No map marks</span>
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
