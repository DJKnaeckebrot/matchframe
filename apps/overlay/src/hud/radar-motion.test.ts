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
      { players: [player({ steamId: "a", x: 0.2, y: 0.4, angle: 90 })], bomb: null },
      tracks,
      0
    )
    expect(view.players[0]).toMatchObject({ x: 0.2, y: 0.4, angle: 90 })
  })

  test("lerps to the next sample over 100ms", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0, y: 0 })], bomb: null }, tracks, 0)
    presentRadarMotion({ players: [player({ steamId: "a", x: 0.1, y: 0 })], bomb: null }, tracks, 1000)
    const mid = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.1, y: 0 })], bomb: null },
      tracks,
      1050
    )
    expect(mid.players[0]?.x).toBeCloseTo(0.05)
    expect(mid.players[0]?.y).toBe(0)
  })

  test("teleport snaps instead of sliding across the radar", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0.1, y: 0.1 })], bomb: null }, tracks, 0)
    const view = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.9, y: 0.9 })], bomb: null },
      tracks,
      100
    )
    expect(view.players[0]?.x).toBe(0.9)
    expect(view.players[0]?.y).toBe(0.9)
  })

  test("rotates the short way across the ±180 seam", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion(
      { players: [player({ steamId: "a", x: 0, y: 0, angle: 170 })], bomb: null },
      tracks,
      0
    )
    presentRadarMotion(
      { players: [player({ steamId: "a", x: 0, y: 0, angle: -170 })], bomb: null },
      tracks,
      1000
    )
    const mid = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0, y: 0, angle: -170 })], bomb: null },
      tracks,
      1050
    )
    expect(mid.players[0]?.angle).toBeCloseTo(180)
  })

  test("reduced motion stays on the latest sample", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0, y: 0 })], bomb: null }, tracks, 0, true)
    const view = presentRadarMotion(
      { players: [player({ steamId: "a", x: 0.5, y: 0.5 })], bomb: null },
      tracks,
      10,
      true
    )
    expect(view.players[0]).toMatchObject({ x: 0.5, y: 0.5 })
  })

  test("drops tracks for players who left the radar", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [player({ steamId: "a", x: 0, y: 0 })], bomb: null }, tracks, 0)
    presentRadarMotion({ players: [], bomb: null }, tracks, 50)
    expect(tracks.players.size).toBe(0)
  })

  test("bomb lerps with the same cadence", () => {
    const tracks = emptyRadarTracks()
    presentRadarMotion({ players: [], bomb: { x: 0, y: 0, kind: "dropped" } }, tracks, 0)
    presentRadarMotion({ players: [], bomb: { x: 0.04, y: 0, kind: "dropped" } }, tracks, 1000)
    const mid = presentRadarMotion(
      { players: [], bomb: { x: 0.04, y: 0, kind: "dropped" } },
      tracks,
      1050
    )
    expect(mid.bomb?.x).toBeCloseTo(0.02)
    expect(mid.bomb?.kind).toBe("dropped")
  })
})
