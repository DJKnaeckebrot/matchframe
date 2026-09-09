import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  compactBroadcastConfig,
  defaultBroadcastConfig,
  defaultSponsorConfig,
  MAX_SPONSORS,
  overlayTeamName,
  parseBroadcastConfig,
  SERIES_LABELS,
  seriesWinsNeeded,
  sponsorNeedsContent,
  type BroadcastConfig,
  type BroadcastSponsorConfig,
  type BroadcastSponsorDraft,
  type BroadcastTeamSlot,
  type SeriesLabel,
  type SponsorDisplayMode,
  type SponsorPosition,
} from "@workspace/presentation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { PageStatus } from "@/components/page-status.tsx"
import { Pulse } from "@/components/pulse.tsx"
import { BroadcastStatusStrip, resolvedBroadcastStatus, useBroadcastStatus } from "@/components/broadcast-status.tsx"
import {
  deleteBroadcastAsset,
  fetchGameState,
  fetchOverlayConfig,
  getBroadcastAsset,
  saveOverlayConfig,
  uploadSponsorLogo,
  uploadTeamLogo,
} from "@/lib/api.ts"

const SERIES_COPY: Record<SeriesLabel, string> = {
  BO1: "One map",
  BO3: "First to 2",
  BO5: "First to 3",
  BO7: "First to 4",
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml"

const SPONSOR_POSITION_OPTIONS: readonly { id: SponsorPosition; label: string }[] = [
  { id: "top-right", label: "Top right" },
  { id: "center", label: "Center" },
]

const SPONSOR_DISPLAY_OPTIONS: readonly { id: SponsorDisplayMode; label: string }[] = [
  { id: "logo", label: "Logo" },
  { id: "text", label: "Text" },
  { id: "logo-text", label: "Logo + text" },
]

function patchSponsor(
  draft: BroadcastConfig,
  index: number,
  patch: BroadcastSponsorDraft
): BroadcastConfig {
  const sponsors = [...(draft.sponsors ?? [])]
  const current: BroadcastSponsorConfig = sponsors[index] ?? {
    ...defaultSponsorConfig,
    enabled: true,
  }
  sponsors[index] = { ...current, ...patch }
  return { ...draft, sponsors }
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
  const statusQuery = useBroadcastStatus()
  const broadcastStatus = resolvedBroadcastStatus(
    statusQuery.data,
    statusQuery.isError,
    statusQuery.isPending
  )
  const [draft, setDraft] = useState<BroadcastConfig>(defaultBroadcastConfig)
  const dirty = useRef(false)
  const draftRef = useRef(draft)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  draftRef.current = draft

  const mutation = useMutation({
    mutationFn: saveOverlayConfig,
    onSuccess: (overlay) => {
      queryClient.setQueryData(["overlay-config"], overlay)
      if (!dirty.current) {
        setDraft(overlay)
      }
    },
  })
  const uploadMutation = useMutation({
    mutationFn: ({ slot, file }: { slot: BroadcastTeamSlot; file: File }) =>
      uploadTeamLogo(slot, file),
    onSuccess: (result) => {
      queryClient.setQueryData(["overlay-config"], result.config)
      setDraft(result.config)
      dirty.current = false
    },
  })
  const sponsorUpload = useMutation({
    mutationFn: ({ index, file }: { index: number; file: File }) =>
      uploadSponsorLogo(index, file),
    onSuccess: (result) => {
      queryClient.setQueryData(["overlay-config"], result.config)
      setDraft(result.config)
      dirty.current = false
    },
  })
  const clearAsset = useMutation({
    mutationFn: deleteBroadcastAsset,
    onSuccess: (overlay) => {
      queryClient.setQueryData(["overlay-config"], overlay)
      setDraft(overlay)
      dirty.current = false
    },
  })

  useEffect(() => {
    if (!overlayQuery.data || dirty.current) {
      return
    }
    const parsed = parseBroadcastConfig(overlayQuery.data)
    setDraft(parsed.success ? parsed.data : defaultBroadcastConfig)
  }, [overlayQuery.data])

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
  }, [])

  const busy =
    mutation.isPending ||
    uploadMutation.isPending ||
    sponsorUpload.isPending ||
    clearAsset.isPending
  const selected = draft.format
  const winsNeeded = seriesWinsNeeded(selected)
  const leftLive = stateQuery.data?.teams[0]?.name
  const rightLive = stateQuery.data?.teams[1]?.name
  const leftLabel = overlayTeamName(draft, "left", leftLive || "Left")
  const rightLabel = overlayTeamName(draft, "right", rightLive || "Right")

  const status = useMemo(() => {
    if (overlayQuery.isError) {
      return "Could not load overlay settings. Is the server running?"
    }
    if (mutation.isError || uploadMutation.isError || sponsorUpload.isError || clearAsset.isError) {
      return "Could not apply overlay settings."
    }
    if (busy) {
      return "Saving."
    }
    if (mutation.isSuccess || uploadMutation.isSuccess || sponsorUpload.isSuccess || clearAsset.isSuccess) {
      return "Live on the overlay."
    }
    return null
  }, [
    overlayQuery.isError,
    mutation.isError,
    mutation.isSuccess,
    uploadMutation.isError,
    uploadMutation.isSuccess,
    sponsorUpload.isError,
    sponsorUpload.isSuccess,
    clearAsset.isError,
    clearAsset.isSuccess,
    busy,
  ])

  function persist(next: BroadcastConfig, immediate = false) {
    // Compact (trim) only on commit. Doing it on every keystroke eats the
    // trailing space you need to type a second word.
    const draftNext = immediate ? compactBroadcastConfig(next) : next
    draftRef.current = draftNext
    setDraft(draftNext)
    dirty.current = true
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const send = () => {
      mutation.mutate(compactBroadcastConfig(draftRef.current), {
        onSettled: () => {
          if (immediate) {
            dirty.current = false
          }
        },
      })
    }
    if (immediate) {
      send()
      return
    }
    saveTimer.current = setTimeout(send, 400)
  }

  function patch(next: BroadcastConfig) {
    persist(next, true)
  }

  const statusTone =
    overlayQuery.isError ||
    mutation.isError ||
    uploadMutation.isError ||
    sponsorUpload.isError ||
    clearAsset.isError
      ? "bad"
      : mutation.isSuccess ||
          uploadMutation.isSuccess ||
          sponsorUpload.isSuccess ||
          clearAsset.isSuccess
        ? "ok"
        : "muted"

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="font-hud text-xl font-semibold tracking-wide">Overlay</h1>
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Broadcast setup for tonight. Names, logos, series marks, and context hit the HUD
            immediately. No OBS reload.
          </p>
        </header>

        {broadcastStatus ? <BroadcastStatusStrip status={broadcastStatus} /> : null}
      </div>

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
                    disabled={busy}
                    onClick={() => {
                      if (selected !== series) {
                        patch({ ...draft, format: series })
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <TeamEditor
                slot="left"
                label="Left"
                draft={draft}
                placeholder={leftLive || "In-game name"}
                disabled={busy}
                onName={(name) =>
                  persist({
                    ...draftRef.current,
                    teams: { ...draftRef.current.teams, left: { ...draftRef.current.teams.left, name } },
                  })
                }
                onCommit={() => persist(draftRef.current, true)}
                onChoose={(file) => uploadMutation.mutate({ slot: "left", file })}
                onClear={() => {
                  const id = draft.teams.left.logoAssetId
                  if (id) {
                    clearAsset.mutate(id)
                  }
                }}
              />
              <TeamEditor
                slot="right"
                label="Right"
                draft={draft}
                placeholder={rightLive || "In-game name"}
                disabled={busy}
                onName={(name) =>
                  persist({
                    ...draftRef.current,
                    teams: { ...draftRef.current.teams, right: { ...draftRef.current.teams.right, name } },
                  })
                }
                onCommit={() => persist(draftRef.current, true)}
                onChoose={(file) => uploadMutation.mutate({ slot: "right", file })}
                onClear={() => {
                  const id = draft.teams.right.logoAssetId
                  if (id) {
                    clearAsset.mutate(id)
                  }
                }}
              />
            </div>
          </section>

          {winsNeeded > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">Series</h2>
                {draft.series.leftMapsWon > 0 || draft.series.rightMapsWon > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      patch({ ...draft, series: { leftMapsWon: 0, rightMapsWon: 0 } })
                    }
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Track the series score here. Changes appear on the live overlay immediately.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MapWinsField
                  label={leftLabel}
                  wins={draft.series.leftMapsWon}
                  max={winsNeeded}
                  disabled={busy}
                  onChange={(wins) =>
                    patch({ ...draft, series: { ...draft.series, leftMapsWon: wins } })
                  }
                />
                <MapWinsField
                  label={rightLabel}
                  wins={draft.series.rightMapsWon}
                  max={winsNeeded}
                  disabled={busy}
                  onChange={(wins) =>
                    patch({ ...draft, series: { ...draft.series, rightMapsWon: wins } })
                  }
                />
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 border-t border-border pt-8">
            <h2 className="text-sm font-medium">Broadcast context</h2>
            <p className="text-sm text-muted-foreground">
              Optional. Empty fields stay off the overlay.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="overlay-event"
                label="Event"
                value={draft.event?.name ?? ""}
                placeholder="Matchframe Cup"
                disabled={false}
                maxLength={48}
                onChange={(name) =>
                  persist({
                    ...draftRef.current,
                    event: { ...draftRef.current.event, name },
                  })
                }
                onCommit={() => persist(draftRef.current, true)}
              />
              <TextField
                id="overlay-stage"
                label="Stage"
                value={draft.event?.stage ?? ""}
                placeholder="Semifinal"
                disabled={false}
                maxLength={48}
                onChange={(stage) =>
                  persist({
                    ...draftRef.current,
                    event: { ...draftRef.current.event, stage },
                  })
                }
                onCommit={() => persist(draftRef.current, true)}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium">Sponsors</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || (draft.sponsors?.length ?? 0) >= MAX_SPONSORS}
                onClick={() =>
                  persist(
                    {
                      ...draftRef.current,
                      sponsors: [
                        ...(draftRef.current.sponsors ?? []),
                        { ...defaultSponsorConfig, enabled: true },
                      ],
                    },
                    true
                  )
                }
              >
                Add
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Partner slots on the overlay. Each can be top-right or center. Changes apply
              immediately.
            </p>
            {(draft.sponsors ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet. Add one for a partner slot.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {(draft.sponsors ?? []).map((sponsor, index) => (
                  <SponsorEditor
                    key={`${sponsor.assetId ?? "slot"}-${index}`}
                    index={index}
                    sponsor={sponsor}
                    disabled={busy}
                    onPatch={(patch, immediate) =>
                      persist(patchSponsor(draftRef.current, index, patch), immediate)
                    }
                    onChoose={(file) => sponsorUpload.mutate({ index, file })}
                    onClearLogo={() => {
                      const id = sponsor.assetId
                      if (id) {
                        clearAsset.mutate(id)
                      }
                    }}
                    onRemove={() => {
                      const id = sponsor.assetId
                      persist(
                        {
                          ...draftRef.current,
                          sponsors: (draftRef.current.sponsors ?? []).filter(
                            (_, item) => item !== index
                          ),
                        },
                        true
                      )
                      if (id) {
                        clearAsset.mutate(id)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {status ? <PageStatus tone={statusTone}>{status}</PageStatus> : null}
    </div>
  )
}

function SponsorEditor({
  index,
  sponsor,
  disabled,
  onPatch,
  onChoose,
  onClearLogo,
  onRemove,
}: {
  index: number
  sponsor: BroadcastSponsorConfig
  disabled: boolean
  onPatch: (patch: BroadcastSponsorDraft, immediate?: boolean) => void
  onChoose: (file: File) => void
  onClearLogo: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={sponsor.enabled}
          disabled={disabled}
          onClick={() => onPatch({ enabled: !sponsor.enabled }, true)}
          className={`border px-2.5 py-1 text-xs ${
            sponsor.enabled
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
        >
          {sponsor.enabled ? "On" : "Off"}
        </button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <LogoSlot
          assetId={sponsor.assetId}
          label="Logo"
          disabled={disabled}
          onChoose={onChoose}
          onClear={onClearLogo}
        />
        <TextField
          id={`overlay-sponsor-${index}`}
          label="Name"
          value={sponsor.name ?? ""}
          placeholder="Optional"
          disabled={false}
          maxLength={32}
          className="min-w-0 flex-1"
          onChange={(name) => onPatch({ name })}
          onCommit={() => onPatch({}, true)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoiceRow
          label="Position"
          value={sponsor.position}
          options={SPONSOR_POSITION_OPTIONS}
          disabled={disabled}
          onChange={(position) => onPatch({ position }, true)}
        />
        <ChoiceRow
          label="Display"
          value={sponsor.displayMode}
          options={SPONSOR_DISPLAY_OPTIONS}
          disabled={disabled}
          onChange={(displayMode) => onPatch({ displayMode }, true)}
        />
      </div>
      {sponsorNeedsContent(sponsor) ? (
        <p className="text-sm text-muted-foreground">
          On, but no name or logo. Hidden on the overlay until one is set.
        </p>
      ) : null}
    </div>
  )
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  disabled: boolean
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div
        className={`grid gap-1.5 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const active = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                if (value !== option.id) {
                  onChange(option.id)
                }
              }}
              className={`border px-2.5 py-2 text-left text-sm ${
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
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
        <Pulse className="h-24" />
        <Pulse className="h-24" />
      </div>
    </div>
  )
}

function TeamEditor({
  slot,
  label,
  draft,
  placeholder,
  disabled,
  onName,
  onCommit,
  onChoose,
  onClear,
}: {
  slot: BroadcastTeamSlot
  label: string
  draft: BroadcastConfig
  placeholder: string
  disabled: boolean
  onName: (value: string) => void
  onCommit: () => void
  onChoose: (file: File) => void
  onClear: () => void
}) {
  const team = draft.teams[slot]
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-end gap-3 ${slot === "right" ? "sm:flex-row-reverse" : ""}`}>
        <LogoSlot
          assetId={team.logoAssetId}
          label={`${label} logo`}
          disabled={disabled}
          onChoose={onChoose}
          onClear={onClear}
        />
        <TextField
          id={`overlay-${slot}-name`}
          label={label}
          value={team.name ?? ""}
          placeholder={placeholder}
          disabled={false}
          maxLength={32}
          className="min-w-0 flex-1"
          onChange={onName}
          onCommit={onCommit}
        />
      </div>
    </div>
  )
}

function LogoSlot({
  assetId,
  label,
  disabled,
  onChoose,
  onClear,
}: {
  assetId?: string
  label: string
  disabled: boolean
  onChoose: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const src = assetId ? getBroadcastAsset(assetId) : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex size-12 items-center justify-center border border-border bg-muted/40">
          {src ? (
            <img
              src={src}
              alt=""
              className="max-h-10 max-w-10 object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <span className="text-[10px] tracking-wide text-muted-foreground">None</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) {
                onChoose(file)
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose
          </Button>
          {assetId ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  placeholder,
  disabled,
  maxLength,
  className,
  onChange,
  onCommit,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  disabled: boolean
  maxLength: number
  className?: string
  onChange: (value: string) => void
  onCommit: () => void
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
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
      <div className="flex gap-1.5" role="group" aria-label={`${label} maps won`}>
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
              className="flex h-9 min-w-9 flex-1 items-center justify-center border border-border hover:border-primary/50 disabled:opacity-50"
            >
              <span
                className="h-2 w-2"
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
          className="h-1.5 w-1.5"
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
