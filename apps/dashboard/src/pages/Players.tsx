import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PlayerState, TeamState } from "@workspace/game-state"
import {
  operatorById,
  operatorsGroupedByFaction,
  resolvePlayerPortrait,
  SIDE_DEFAULT_OPERATOR,
  type OperatorPortrait,
  type PlayerPresentation,
  type PortraitType,
} from "@workspace/presentation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import {
  deletePlayerPresentation,
  fetchGameState,
  fetchPlayersConfig,
  savePlayerPresentation,
} from "@/lib/api.ts"
import { getPortraitAsset } from "@/lib/portrait-assets.ts"

export function PlayersPage() {
  const queryClient = useQueryClient()
  const stateQuery = useQuery({
    queryKey: ["game-state"],
    queryFn: fetchGameState,
    retry: 8,
    retryDelay: 400,
    refetchInterval: 1000,
  })
  const configQuery = useQuery({
    queryKey: ["players-config"],
    queryFn: fetchPlayersConfig,
    retry: 8,
    retryDelay: 400,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const players = stateQuery.data?.players ?? []
  const teams = stateQuery.data?.teams ?? []
  const config = configQuery.data ?? {}

  useEffect(() => {
    if (selectedId && !players.some((player) => player.steamId === selectedId)) {
      setSelectedId(players[0]?.steamId ?? null)
    }
    if (!selectedId && players[0]) {
      setSelectedId(players[0].steamId)
    }
  }, [players, selectedId])

  const selected = players.find((player) => player.steamId === selectedId) ?? null
  const mutation = useMutation({
    mutationFn: ({ steamId, entry }: { steamId: string; entry: PlayerPresentation }) =>
      savePlayerPresentation(steamId, entry),
    onSuccess: (next) => {
      queryClient.setQueryData(["players-config"], next)
    },
  })
  const clearMutation = useMutation({
    mutationFn: deletePlayerPresentation,
    onSuccess: (next) => {
      queryClient.setQueryData(["players-config"], next)
    },
  })

  const status = useMemo(() => {
    if (stateQuery.isError) {
      return "Could not load match state. Is the server running?"
    }
    if (configQuery.isError) {
      return "Could not load player presentation."
    }
    if (mutation.isError || clearMutation.isError) {
      return "Could not save player presentation."
    }
    if (mutation.isSuccess || clearMutation.isSuccess) {
      return "Applied to the live overlay."
    }
    return null
  }, [
    stateQuery.isError,
    configQuery.isError,
    mutation.isError,
    mutation.isSuccess,
    clearMutation.isError,
    clearMutation.isSuccess,
  ])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Players</h1>
        <p className="text-sm text-muted-foreground">
          Portraits follow Steam ID. Change a name in CS2 and the override still sticks.
        </p>
      </header>

      {!stateQuery.data ? (
        <EmptyState loading={stateQuery.isLoading} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ul className="divide-y divide-border border-y border-border">
            {players.map((player) => (
              <PlayerRow
                key={player.steamId}
                player={player}
                team={teamFor(teams, player.teamId)}
                config={config[player.steamId]}
                selected={player.steamId === selectedId}
                onSelect={() => setSelectedId(player.steamId)}
              />
            ))}
          </ul>
          {selected ? (
            <PlayerEditor
              player={selected}
              team={teamFor(teams, selected.teamId)}
              entry={config[selected.steamId]}
              pending={mutation.isPending || clearMutation.isPending}
              onSave={(entry) => mutation.mutate({ steamId: selected.steamId, entry })}
              onClear={() => clearMutation.mutate(selected.steamId)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select a player to edit presentation.</p>
          )}
        </div>
      )}

      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="border-y border-border py-10">
      <p className="text-sm text-muted-foreground">
        {loading
          ? "Loading match state…"
          : "Start CS2 or send a fixture to configure player presentation."}
      </p>
    </div>
  )
}

function PlayerRow({
  player,
  team,
  config,
  selected,
  onSelect,
}: {
  player: PlayerState
  team: TeamState | undefined
  config: PlayerPresentation | undefined
  selected: boolean
  onSelect: () => void
}) {
  const resolved = resolvePlayerPortrait(player, config ? { [player.steamId]: config } : {})
  const src = getPortraitAsset(resolved.assetId)
  const accent = player.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 py-3 text-left ${
          selected ? "bg-muted/60" : "hover:bg-muted/30"
        }`}
      >
        <span
          className="relative h-14 w-11 shrink-0 overflow-hidden"
          style={{ background: `color-mix(in srgb, ${accent} 28%, transparent)` }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-bottom"
            />
          ) : (
            <span className="flex h-full items-end justify-center pb-1 text-[10px] text-muted-foreground">
              —
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{player.name || player.steamId}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {player.steamId}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-muted-foreground">
          <span className="block">{team?.name ?? player.teamId}</span>
          <span className="block">{player.side}</span>
          <span className="block">{sourceLabel(config)}</span>
        </span>
      </button>
    </li>
  )
}

function PlayerEditor({
  player,
  team,
  entry,
  pending,
  onSave,
  onClear,
}: {
  player: PlayerState
  team: TeamState | undefined
  entry: PlayerPresentation | undefined
  pending: boolean
  onSave: (entry: PlayerPresentation) => void
  onClear: () => void
}) {
  const [displayName, setDisplayName] = useState(entry?.displayName ?? "")
  useEffect(() => {
    setDisplayName(entry?.displayName ?? "")
  }, [player.steamId, entry?.displayName])

  const mode: "automatic" | PortraitType = entry?.portrait?.type ?? "automatic"
  const accent = player.side === "CT" ? "var(--mf-ct)" : "var(--mf-t)"
  const preview = resolvePlayerPortrait(player, entry ? { [player.steamId]: entry } : {})
  const previewSrc = getPortraitAsset(preview.assetId)

  function persist(next: PlayerPresentation) {
    onSave({
      ...(next.displayName?.trim() ? { displayName: next.displayName.trim() } : {}),
      ...(next.portrait ? { portrait: next.portrait } : {}),
    })
  }

  return (
    <aside className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-medium">{player.name || player.steamId}</div>
        <div className="font-mono text-xs text-muted-foreground">{player.steamId}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {team?.name ?? player.teamId} · {player.side}
        </div>
      </div>

      <div
        className="relative h-36 overflow-hidden"
        style={{ background: `color-mix(in srgb, ${accent} 22%, transparent)` }}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="player-display-name">Display name</Label>
        <Input
          id="player-display-name"
          value={displayName}
          maxLength={32}
          placeholder={player.name || "Live GSI name"}
          onChange={(event) => setDisplayName(event.target.value)}
          onBlur={() => {
            const trimmed = displayName.trim()
            if (trimmed === (entry?.displayName ?? "")) {
              return
            }
            persist({
              displayName: trimmed || undefined,
              portrait: entry?.portrait,
            })
          }}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Portrait</legend>
        <div className="flex flex-wrap gap-1.5">
          <SourceButton
            active={mode === "automatic"}
            disabled={pending}
            onClick={() => persist({ displayName: displayName.trim() || undefined })}
          >
            Automatic
          </SourceButton>
          <SourceButton
            active={mode === "operator"}
            disabled={pending}
            onClick={() =>
              persist({
                displayName: displayName.trim() || undefined,
                portrait: {
                  type: "operator",
                  value:
                    entry?.portrait?.type === "operator"
                      ? entry.portrait.value
                      : SIDE_DEFAULT_OPERATOR[player.side],
                },
              })
            }
          >
            Operator
          </SourceButton>
          <SourceButton active={mode === "custom"} disabled>
            Custom
          </SourceButton>
        </div>
        <p className="text-xs text-muted-foreground">
          Automatic uses SAS / Phoenix when no operator is set. Art is local CS2
          inventory renders — run `bun run portraits:import` once. Overlay never
          loads csgodatabase or Steam at runtime.
        </p>
      </fieldset>

      {mode === "operator" ? (
        <div className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto pr-1">
          <OperatorSide
            side="CT"
            selectedId={entry?.portrait?.type === "operator" ? entry.portrait.value : undefined}
            disabled={pending}
            onPick={(id) =>
              persist({
                displayName: displayName.trim() || undefined,
                portrait: { type: "operator", value: id },
              })
            }
          />
          <OperatorSide
            side="T"
            selectedId={entry?.portrait?.type === "operator" ? entry.portrait.value : undefined}
            disabled={pending}
            onPick={(id) =>
              persist({
                displayName: displayName.trim() || undefined,
                portrait: { type: "operator", value: id },
              })
            }
          />
        </div>
      ) : null}

      {entry ? (
        <Button type="button" variant="outline" disabled={pending} onClick={onClear}>
          Clear presentation
        </Button>
      ) : null}
    </aside>
  )
}

function OperatorSide({
  side,
  selectedId,
  disabled,
  onPick,
}: {
  side: "CT" | "T"
  selectedId: string | undefined
  disabled: boolean
  onPick: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {operatorsGroupedByFaction(side).map((group) => (
        <OperatorGroup
          key={group.faction}
          label={group.faction}
          selectedId={selectedId}
          disabled={disabled}
          onPick={onPick}
          operators={group.operators}
        />
      ))}
    </div>
  )
}

function OperatorGroup({
  label,
  operators,
  selectedId,
  disabled,
  onPick,
}: {
  label: string
  operators: readonly OperatorPortrait[]
  selectedId: string | undefined
  disabled: boolean
  onPick: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {operators.map((operator) => {
          const src = getPortraitAsset(operator.id)
          const selected = operator.id === selectedId
          return (
            <button
              key={operator.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(operator.id)}
              className={`flex flex-col overflow-hidden border text-left ${
                selected ? "border-foreground" : "border-border hover:border-foreground/50"
              }`}
            >
              <span className="relative block h-24 bg-muted">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : null}
              </span>
              <span className="px-1.5 py-1">
                <span className="block text-xs font-medium">{operator.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SourceButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick?: () => void
  children: string
}) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

function sourceLabel(entry: PlayerPresentation | undefined): string {
  if (entry?.portrait?.type === "operator") {
    const operator = operatorById(entry.portrait.value)
    return operator ? `Operator · ${operator.label}` : `Operator · ${entry.portrait.value}`
  }
  if (entry?.portrait?.type === "custom") {
    return "Custom"
  }
  return "Automatic"
}

function teamFor(teams: readonly TeamState[], teamId: string): TeamState | undefined {
  return teams.find((team) => team.id === teamId)
}
