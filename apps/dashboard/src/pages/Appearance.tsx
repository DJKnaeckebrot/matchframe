import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  cssColorSchema,
  matchframeThemeSchema,
  THEME_PRESETS,
  themeToCssVars,
  themesEqual,
} from "@workspace/theme"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { PageStatus } from "@/components/page-status.tsx"
import { Pulse } from "@/components/pulse.tsx"
import {
  defaultTheme,
  fetchTheme,
  saveTheme,
  THEME_TOKEN_LABELS,
  THEME_TOKENS,
} from "@/lib/api.ts"
import type { MatchframeTheme, ThemeToken } from "@/lib/api.ts"

export function AppearancePage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["theme"],
    queryFn: fetchTheme,
    retry: 8,
    retryDelay: 400,
  })
  const [draft, setDraft] = useState<MatchframeTheme>(defaultTheme)

  useEffect(() => {
    if (query.data) {
      setDraft(query.data)
    }
  }, [query.data])

  const parsed = matchframeThemeSchema.safeParse(draft)
  const valid = parsed.success ? parsed.data : null
  const dirty = query.data ? !themesEqual(draft, query.data) : true

  const mutation = useMutation({
    mutationFn: saveTheme,
    onSuccess: (theme) => {
      queryClient.setQueryData(["theme"], theme)
      setDraft(theme)
    },
  })

  const status = useMemo(() => {
    if (query.isError) {
      return "Could not load colors. Is the server running?"
    }
    if (mutation.isError) {
      return "Could not apply colors."
    }
    if (mutation.isSuccess && !dirty) {
      return "Applied to the live overlay."
    }
    if (!valid) {
      return "Fix invalid colors before applying."
    }
    return null
  }, [query.isError, mutation.isError, mutation.isSuccess, dirty, valid])

  const statusTone = query.isError || mutation.isError || !valid ? "bad" : mutation.isSuccess && !dirty ? "ok" : "muted"

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-hud text-xl font-semibold tracking-wide">Appearance</h1>
        <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          Pick a palette, then tune tokens if tonight needs it. Apply when ready. The
          overlay changes without a reload.
        </p>
      </header>

      {query.isLoading ? (
        <AppearanceSkeleton />
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) {
              mutation.mutate(valid)
            }
          }}
        >
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Palette</h2>
            <div
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Palette"
            >
              {THEME_PRESETS.map((preset) => {
                const active = themesEqual(draft, preset.theme)
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDraft(preset.theme)}
                    className={`flex flex-col gap-3 border px-3 py-4 text-left ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span className="font-hud text-sm tracking-wide">{preset.label}</span>
                    <span className="text-sm font-medium text-inherit">{preset.description}</span>
                    <span className="flex gap-1" aria-hidden="true">
                      {(["accent", "ct", "terrorist"] as const).map((token) => (
                        <span
                          key={token}
                          className="h-3 flex-1"
                          style={{ background: preset.theme[token] }}
                        />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <ThemePreview theme={draft} />

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {THEME_TOKENS.map((token) => (
              <ColorField
                key={token}
                token={token}
                value={draft[token]}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, [token]: value }))
                }
              />
            ))}
          </div>

          {status ? <PageStatus tone={statusTone}>{status}</PageStatus> : null}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft(defaultTheme)}>
              Reset to defaults
            </Button>
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending ? "Applying…" : "Apply to overlay"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function ThemePreview({ theme }: { theme: MatchframeTheme }) {
  return (
    <div className="border border-border p-3" style={themeToCssVars(theme) as CSSProperties}>
      <div className="flex items-center gap-4 bg-(--mf-surface) px-3 py-2 text-(--mf-text)">
        <span className="font-hud text-xs font-semibold tracking-wide" style={{ color: "var(--mf-ct)" }}>
          Northwind
        </span>
        <span className="font-hud text-lg tabular-nums">8</span>
        <span className="flex-1 text-center font-hud text-xs tracking-wide text-(--mf-accent)">
          Inferno
        </span>
        <span className="font-hud text-lg tabular-nums">6</span>
        <span className="font-hud text-xs font-semibold tracking-wide" style={{ color: "var(--mf-t)" }}>
          Redline
        </span>
      </div>
    </div>
  )
}

function AppearanceSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Pulse className="h-28" />
        <Pulse className="h-28" />
        <Pulse className="h-28" />
      </div>
      <Pulse className="h-14" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Pulse className="h-16" />
        <Pulse className="h-16" />
        <Pulse className="h-16" />
        <Pulse className="h-16" />
      </div>
    </div>
  )
}

function ColorField({
  token,
  value,
  onChange,
}: {
  token: ThemeToken
  value: string
  onChange: (value: string) => void
}) {
  const hexId = `theme-${token}-hex`
  const pickerId = `theme-${token}-picker`

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={hexId}>{THEME_TOKEN_LABELS[token]}</Label>
      <div className="flex items-center gap-2">
        <input
          id={pickerId}
          type="color"
          aria-label={`${THEME_TOKEN_LABELS[token]} color`}
          className="h-8 w-8 shrink-0 cursor-pointer border border-input bg-transparent p-0"
          value={toColorInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={hexId}
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!cssColorSchema.safeParse(value).success}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}

function toColorInputValue(value: string): string {
  const hex = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex
  }
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  return "#000000"
}
