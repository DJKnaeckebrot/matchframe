import { describe, expect, test } from "bun:test"

import { emptyRadarTracks, presentRadarMotion } from "./radar-motion"
import type { RadarPlayerView } from "./radar"

function player(partial: Partial<RadarPlayerView> & Pick<RadarPlayerView, "steamId" | "x" | "y">): RadarPlayerView {
  return {
    side: "CT",
    observed: false,
    ...partial,
  }
}

describe("presentRadarMotion", () => {
  test("first sample snaps", () => {
    const tracks = emptyRadarTracks()
    const view = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.2, y: 0.4, angle: 90 })], bomb: null, grenades: [] },
      tracks,
      0
    )
    expect(view.players[0]).toMatchObject({ x: 0.2, y: 0.4, angle: 90 })
  })

  test("lerps to the next sample over 100ms", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0, y: 0 })], bomb: null, grenades: [] }, tracks, 0)
    presentRadarMotion({ players: [player({ steamId: "a", x: 0.1, y: 0 })], bomb: null, grenades: [] }, tracks, 1000)
    const mid = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.1, y: 0 })], bomb: null, grenades: [] },
      tracks,
      1050
    )
    expect(mid.players[0]?.x).toBeCloseTo(0.05)
    expect(mid.players[0]?.y).toBe(0)
  })

  test("teleport snaps instead of sliding across the radar", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0.1, y: 0.1 })], bomb: null, grenades: [] }, tracks, 0)
    const view = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.9, y: 0.9 })], bomb: null, grenades: [] },
      tracks,
      100
    )
    expect(view.players[0]?.x).toBe(0.9)
    expect(view.players[0]?.y).toBe(0.9)
  })

  test("rotates the short way across the ±180 seam", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion(
      { players: [player({ steamId: "a", x: 0, y: 0, angle: 170 })], bomb: null, grenades: [] },
      tracks,
      0
    )
    presentRadarMotion(
      { players: [player({ steamId: "a", x: 0, y: 0, angle: -170 })], bomb: null, grenades: [] },
      tracks,
      1000
    )
    const mid = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0, y: 0, angle: -170 })], bomb: null, grenades: [] },
      tracks,
      1050
    )
    expect(mid.players[0]?.angle).toBeCloseTo(180)
  })

  test("reduced motion stays on the latest sample", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0, y: 0 })], bomb: null, grenades: [] }, tracks, 0, true)
    const view = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.5, y: 0.5 })], bomb: null, grenades: [] },
      tracks,
      10,
      true
    )
    expect(view.players[0]).toMatchObject({ x: 0.5, y: 0.5 })
  })

  test("drops tracks for players who left the radar", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0, y: 0 })], bomb: null, grenades: [] }, tracks, 0)
    presentRadarMotion({ players: [], bomb: null, grenades: [] }, tracks, 50)
    expect(tracks.players.size).toBe(0)
  })

  test("bomb lerps with the same cadence", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [], bomb: { x: 0, y: 0, kind: "dropped" }, grenades: [] }, tracks, 0)
    presentRadarMotion({ players: [], bomb: { x: 0.04, y: 0, kind: "dropped" }, grenades: [] }, tracks, 1000)
    const mid = presentRadarMotion(
      { players: [], bomb: { x: 0.04, y: 0, kind: "dropped" }, grenades: [] },
      tracks,
      1050
    )
    expect(mid.bomb?.x).toBeCloseTo(0.02)
    expect(mid.bomb?.kind).toBe("dropped")
  })

  test("in-flight grenades lerp between GSI samples", () => {
    const tracks = emptyRadarTracks()
    const grenade = {
      id: "401",
      type: "smoke" as const,
      x: 0,
      y: 0,
      state: "projectile" as const,
    }
    presentRadarMotion({ players: [], bomb: null, grenades: [grenade] }, tracks, 0)
    presentRadarMotion({ players: [], bomb: null, grenades: [{ ...grenade, x: 0.1 }] }, tracks, 1000)
    const mid = presentRadarMotion(
      { players: [], bomb: null, grenades: [{ ...grenade, x: 0.1 }] },
      tracks,
      1050
    )
    expect(mid.grenades[0]?.x).toBeCloseTo(0.05)
    expect(mid.grenades[0]?.id).toBe("401")
  })

  test("inferno flame points stay on the sample, not the lerped origin", () => {
    const tracks = emptyRadarTracks()
    const grenade = {
      id: "505",
      type: "molotov" as const,
      x: 0.5,
      y: 0.45,
      state: "active" as const,
      flamePoints: [{ x: 0.5, y: 0.45 }, { x: 0.52, y: 0.46 }],
    }
    presentRadarMotion({ players: [], bomb: null, grenades: [grenade] }, tracks, 0)
    const next = { ...grenade, x: 0.51, flamePoints: [{ x: 0.51, y: 0.45 }, { x: 0.53, y: 0.46 }] }
    presentRadarMotion({ players: [], bomb: null, grenades: [next] }, tracks, 1000)
    const mid = presentRadarMotion({ players: [], bomb: null, grenades: [next] }, tracks, 1050)
    expect(mid.grenades[0]?.x).toBeCloseTo(0.505)
    expect(mid.grenades[0]?.flamePoints).toEqual(next.flamePoints)
  })
})
