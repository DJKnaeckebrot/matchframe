import { describe, expect, test } from "bun:test"

import { presentObjectiveProgress } from "./countdown"
import type { ObjectiveOrigin, ObjectiveSnapshot } from "./countdown"

function defusing(overrides: Partial<ObjectiveSnapshot> = {}): ObjectiveSnapshot {
  return {
    state: "defusing",
    bombRemaining: 20,
    bombDuration: 28.4,
    defuseRemaining: 4,
    defuseDuration: 4,
    ...overrides,
  }
}

function step(
  snapshot: ObjectiveSnapshot,
  origin: ObjectiveOrigin,
  now: number
) {
  return presentObjectiveProgress(snapshot, origin, now)
}

describe("presentObjectiveProgress", () => {
  test("active defuse above zero: bomb and defuse both interpolate", () => {
    const snapshot = defusing()
    const started = step(snapshot, {}, 0)
    const next = step(snapshot, started.origin, 1000)

    expect(next.presentation.bomb?.remaining).toBeCloseTo(19)
    expect(next.presentation.defuse?.remaining).toBeCloseTo(3)
    expect(next.presentation.bomb?.duration).toBe(28.4)
    expect(next.presentation.defuse?.duration).toBe(4)
  })

  test("defuse reaches zero: both visual timers freeze", () => {
    const snapshot = defusing()
    const started = step(snapshot, {}, 0)
    const atZero = step(snapshot, started.origin, 4000)
    expect(atZero.presentation.defuse?.remaining).toBe(0)
    expect(atZero.presentation.bomb?.remaining).toBeCloseTo(16)

    const later = step(snapshot, atZero.origin, 7000)
    expect(later.presentation.defuse?.remaining).toBe(0)
    expect(later.presentation.bomb?.remaining).toBe(atZero.presentation.bomb?.remaining)
    expect(later.presentation.bomb).not.toBeNull()
    expect(later.presentation.defuse).not.toBeNull()
  })

  test("next state planted: defuse clears and bomb resumes", () => {
    const snapshot = defusing()
    const started = step(snapshot, {}, 0)
    const frozen = step(snapshot, started.origin, 5000)
    expect(frozen.presentation.defuse?.remaining).toBe(0)

    const planted: ObjectiveSnapshot = {
      state: "planted",
      bombRemaining: 17.3,
      bombDuration: 28.4,
    }
    const resumed = step(planted, frozen.origin, 6000)
    expect(resumed.presentation.defuse).toBeNull()
    expect(resumed.presentation.bomb?.remaining).toBeCloseTo(17.3)

    const later = step(planted, resumed.origin, 7000)
    expect(later.presentation.defuse).toBeNull()
    expect(later.presentation.bomb?.remaining).toBeCloseTo(16.3)
  })

  test("next state defused: bars clear", () => {
    const snapshot = defusing()
    const started = step(snapshot, {}, 0)
    const frozen = step(snapshot, started.origin, 5000)
    const cleared = step({ state: "defused" }, frozen.origin, 6000)
    expect(cleared.presentation).toEqual({ bomb: null, defuse: null })
  })

  test("next state exploded: bars clear", () => {
    const snapshot = defusing()
    const started = step(snapshot, {}, 0)
    const frozen = step(snapshot, started.origin, 5000)
    const cleared = step({ state: "exploded" }, frozen.origin, 6000)
    expect(cleared.presentation).toEqual({ bomb: null, defuse: null })
  })
})
