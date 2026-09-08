import { useEffect, useRef, useState } from "react"
import type { BombStatus } from "@workspace/game-state"

const PLANTED_UI = new Set<BombStatus>(["planted", "defusing", "exploding"])

export type ObjectiveSnapshot = {
  state: BombStatus | null
  bombRemaining?: number
  bombDuration?: number
  defuseRemaining?: number
  defuseDuration?: number
}

type Clock = {
  remaining: number
  at: number
}

export type ObjectiveOrigin = {
  bomb?: Clock
  defuse?: Clock
  /** Displayed bomb remaining when interpolated defuse first hit 0. */
  frozenBombRemaining?: number
}

export type ObjectiveBarPresentation = {
  remaining?: number
  duration?: number
}

export type ObjectivePresentation = {
  bomb: ObjectiveBarPresentation | null
  defuse: ObjectiveBarPresentation | null
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function syncClock(clock: Clock | undefined, remaining: number | undefined, now: number): Clock | undefined {
  if (remaining === undefined) {
    return undefined
  }
  if (!clock || clock.remaining !== remaining) {
    return { remaining, at: now }
  }
  return clock
}

function interpolated(
  clock: Clock | undefined,
  remaining: number | undefined,
  now: number,
  reducedMotion: boolean
): number | undefined {
  if (remaining === undefined) {
    return undefined
  }
  if (reducedMotion || !clock) {
    return Math.max(0, remaining)
  }
  return Math.max(0, clock.remaining - (now - clock.at) / 1000)
}

function bar(
  remaining: number | undefined,
  duration: number | undefined
): ObjectiveBarPresentation {
  return {
    ...(remaining !== undefined ? { remaining } : {}),
    ...(duration !== undefined ? { duration } : {}),
  }
}

/**
 * Presentation-only plant/defuse clocks. Does not mutate GameState or emit events.
 *
 * While defusing, if a valid defuse countdown interpolates to 0, freeze both
 * visual timers until the next authoritative snapshot.
 */
export function presentObjectiveProgress(
  snapshot: ObjectiveSnapshot,
  origin: ObjectiveOrigin,
  now: number,
  reducedMotion = false
): { presentation: ObjectivePresentation; origin: ObjectiveOrigin } {
  const state = snapshot.state
  if (!state || !PLANTED_UI.has(state)) {
    return { presentation: { bomb: null, defuse: null }, origin: {} }
  }

  const next: ObjectiveOrigin = {
    bomb: syncClock(origin.bomb, snapshot.bombRemaining, now),
  }

  if (state !== "defusing") {
    return {
      presentation: {
        bomb: bar(
          interpolated(next.bomb, snapshot.bombRemaining, now, reducedMotion),
          snapshot.bombDuration
        ),
        defuse: null,
      },
      origin: { bomb: next.bomb },
    }
  }

  next.defuse = syncClock(origin.defuse, snapshot.defuseRemaining, now)
  const defuseShown = interpolated(next.defuse, snapshot.defuseRemaining, now, reducedMotion)
  const bombShown = interpolated(next.bomb, snapshot.bombRemaining, now, reducedMotion)
  const freezeDefuse =
    snapshot.defuseRemaining !== undefined && defuseShown !== undefined && defuseShown <= 0

  if (freezeDefuse) {
    const frozen = origin.frozenBombRemaining ?? bombShown
    if (frozen !== undefined) {
      next.frozenBombRemaining = frozen
    }
    return {
      presentation: {
        bomb: bar(frozen, snapshot.bombDuration),
        defuse: bar(0, snapshot.defuseDuration),
      },
      origin: next,
    }
  }

  return {
    presentation: {
      bomb: bar(bombShown, snapshot.bombDuration),
      defuse: bar(defuseShown, snapshot.defuseDuration),
    },
    origin: { bomb: next.bomb, defuse: next.defuse },
  }
}

export function snapshotFromBomb(bomb: {
  state: BombStatus
  countdown?: number
  countdownDuration?: number
  defuseCountdown?: number
  defuseDuration?: number
} | null): ObjectiveSnapshot {
  if (!bomb) {
    return { state: null }
  }
  return {
    state: bomb.state,
    ...(bomb.countdown !== undefined ? { bombRemaining: bomb.countdown } : {}),
    ...(bomb.countdownDuration !== undefined ? { bombDuration: bomb.countdownDuration } : {}),
    ...(bomb.defuseCountdown !== undefined ? { defuseRemaining: bomb.defuseCountdown } : {}),
    ...(bomb.defuseDuration !== undefined ? { defuseDuration: bomb.defuseDuration } : {}),
  }
}

export function useObjectivePresentation(snapshot: ObjectiveSnapshot): ObjectivePresentation {
  const originRef = useRef<ObjectiveOrigin>({})
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const [presentation, setPresentation] = useState<ObjectivePresentation>({
    bomb: null,
    defuse: null,
  })

  const state = snapshot.state
  const bombRemaining = snapshot.bombRemaining
  const bombDuration = snapshot.bombDuration
  const defuseRemaining = snapshot.defuseRemaining
  const defuseDuration = snapshot.defuseDuration

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const apply = (now: number) => {
      const result = presentObjectiveProgress(
        snapshotRef.current,
        originRef.current,
        now,
        reduced
      )
      originRef.current = result.origin
      setPresentation(result.presentation)
    }

    const timing =
      state === "planted" || state === "defusing" || state === "exploding"

    apply(performance.now())
    if (reduced || !timing || originRef.current.frozenBombRemaining !== undefined) {
      return
    }

    let frame = 0
    const tick = (now: number) => {
      apply(now)
      if (originRef.current.frozenBombRemaining === undefined) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state, bombRemaining, bombDuration, defuseRemaining, defuseDuration])

  return presentation
}
