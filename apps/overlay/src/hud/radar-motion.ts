import { useEffect, useRef, useState } from "react"

import type { RadarBombView, RadarGrenadeView, RadarPlayerView } from "./radar"

/** Matches `buffer`/`throttle` 0.1 in the GSI cfg. */
const DEFAULT_MS = 100
const MIN_MS = 50
const MAX_MS = 200
/** ~12% of the radar in one sample — respawn/teleport, not a run step. */
const SNAP_DIST = 0.12
/**
 * Hold after the sample is a hitch when GSI is late.
 * 1.3 = 30ms overshoot at 100ms cadence, then the next sample corrects.
 */
const MAX_T = 1.3

type Sample = {
  x: number
  y: number
  angle?: number
}

export type RadarTrack = {
  from: Sample
  to: Sample
  start: number
  duration: number
}

export type RadarTracks = {
  players: Map<string, RadarTrack>
  grenades: Map<string, RadarTrack>
  bomb?: RadarTrack
}

export type RadarMotionInput = {
  players: readonly RadarPlayerView[]
  bomb: RadarBombView | null
  grenades: readonly RadarGrenadeView[]
}

export type RadarMotionView = {
  players: RadarPlayerView[]
  bomb: RadarBombView | null
  grenades: RadarGrenadeView[]
}

export function emptyRadarTracks(): RadarTracks {
  return { players: new Map(), grenades: new Map() }
}

/**
 * Catch-up lerp between GSI radar samples. Mutates `tracks`.
 * Does not touch GameState — presentation only.
 */
export function presentRadarMotion(
  input: RadarMotionInput,
  tracks: RadarTracks,
  now: number,
  reducedMotion = false
): RadarMotionView {
  if (reducedMotion) {
    tracks.players.clear()
    tracks.grenades.clear()
    delete tracks.bomb
    return {
      players: input.players.map(copyPlayer),
      bomb: copyBomb(input.bomb),
      grenades: input.grenades.map(copyGrenade),
    }
  }

  const seen = new Set<string>()
  const players: RadarPlayerView[] = []
  for (const player of input.players) {
    seen.add(player.steamId)
    const sample = toSample(player)
    const track = retarget(tracks.players.get(player.steamId), sample, now)
    tracks.players.set(player.steamId, track)
    const posed = sampleAt(track, now)
    players.push(withPose(player, posed))
  }
  for (const id of tracks.players.keys()) {
    if (!seen.has(id)) {
      tracks.players.delete(id)
    }
  }

  const grenades = poseGrenades(input.grenades, tracks, now)

  if (!input.bomb) {
    delete tracks.bomb
    return { players, bomb: null, grenades }
  }

  const bombSample = toSample(input.bomb)
  tracks.bomb = retarget(tracks.bomb, bombSample, now)
  const posed = sampleAt(tracks.bomb, now)
  return { players, bomb: { ...input.bomb, x: posed.x, y: posed.y }, grenades }
}

export function useRadarMotion(
  players: readonly RadarPlayerView[],
  bomb: RadarBombView | null,
  grenades: readonly RadarGrenadeView[]
): RadarMotionView {
  const tracksRef = useRef<RadarTracks>(emptyRadarTracks())
  const inputRef = useRef<RadarMotionInput>({ players, bomb, grenades })
  inputRef.current = { players, bomb, grenades }
  const presentedRef = useRef<RadarMotionView>({
    players: players.map(copyPlayer),
    bomb: copyBomb(bomb),
    grenades: grenades.map(copyGrenade),
  })
  const [presented, setPresented] = useState<RadarMotionView>(presentedRef.current)

  useEffect(() => {
    const reduced = prefersReducedMotion()
    let frame = 0
    const tick = (now: number) => {
      const next = presentRadarMotion(inputRef.current, tracksRef.current, now, reduced)
      if (!sameView(presentedRef.current, next)) {
        presentedRef.current = next
        setPresented(next)
      }
      if (!reduced) {
        frame = requestAnimationFrame(tick)
      }
    }

    tick(performance.now())
    return () => cancelAnimationFrame(frame)
  }, [])

  return presented
}

function retarget(track: RadarTrack | undefined, to: Sample, now: number): RadarTrack {
  if (!track) {
    return { from: to, to, start: now, duration: DEFAULT_MS }
  }
  if (!sampleChanged(track.to, to)) {
    return track
  }
  const from = sampleAt(track, now)
  if (dist2(from, to) > SNAP_DIST * SNAP_DIST) {
    return { from: to, to, start: now, duration: DEFAULT_MS }
  }
  const stationary = track.from.x === track.to.x && track.from.y === track.to.y
  const duration = stationary
    ? DEFAULT_MS
    : Math.min(MAX_MS, Math.max(MIN_MS, now - track.start))
  return { from, to, start: now, duration }
}

function sampleAt(track: RadarTrack, now: number): Sample {
  const t = track.duration <= 0 ? 1 : Math.min(MAX_T, Math.max(0, (now - track.start) / track.duration))
  const angle = lerpAngle(track.from.angle, track.to.angle, t)
  return {
    x: track.from.x + (track.to.x - track.from.x) * t,
    y: track.from.y + (track.to.y - track.from.y) * t,
    ...(angle !== undefined ? { angle } : {}),
  }
}

function lerpAngle(from: number | undefined, to: number | undefined, t: number): number | undefined {
  if (to === undefined) {
    return from
  }
  if (from === undefined) {
    return to
  }
  let delta = to - from
  while (delta > 180) {
    delta -= 360
  }
  while (delta < -180) {
    delta += 360
  }
  return from + delta * t
}

function withPose(player: RadarPlayerView, posed: Sample): RadarPlayerView {
  const next: RadarPlayerView = { ...player, x: posed.x, y: posed.y }
  if (posed.angle === undefined) {
    delete next.angle
  } else {
    next.angle = posed.angle
  }
  return next
}

function poseGrenades(
  grenades: readonly RadarGrenadeView[],
  tracks: RadarTracks,
  now: number
): RadarGrenadeView[] {
  const seen = new Set<string>()
  const next: RadarGrenadeView[] = []
  for (const grenade of grenades) {
    seen.add(grenade.id)
    const sample = toSample(grenade)
    const track = retarget(tracks.grenades.get(grenade.id), sample, now)
    tracks.grenades.set(grenade.id, track)
    const posed = sampleAt(track, now)
    next.push({ ...grenade, x: posed.x, y: posed.y })
  }
  for (const id of tracks.grenades.keys()) {
    if (!seen.has(id)) {
      tracks.grenades.delete(id)
    }
  }
  return next
}

function toSample(point: Sample): Sample {
  return point.angle === undefined ? { x: point.x, y: point.y } : { x: point.x, y: point.y, angle: point.angle }
}

function sampleChanged(a: Sample, b: Sample): boolean {
  return a.x !== b.x || a.y !== b.y || a.angle !== b.angle
}

function dist2(a: Sample, b: Sample): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function copyPlayer(player: RadarPlayerView): RadarPlayerView {
  return { ...player }
}

function copyBomb(bomb: RadarBombView | null): RadarBombView | null {
  return bomb ? { ...bomb } : null
}

function copyGrenade(grenade: RadarGrenadeView): RadarGrenadeView {
  return { ...grenade }
}

function sameView(a: RadarMotionView, b: RadarMotionView): boolean {
  if (a.players.length !== b.players.length || a.grenades.length !== b.grenades.length) {
    return false
  }
  for (let i = 0; i < a.players.length; i++) {
    const left = a.players[i]
    const right = b.players[i]
    if (
      !left ||
      !right ||
      left.steamId !== right.steamId ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.angle !== right.angle ||
      left.observed !== right.observed ||
      left.slot !== right.slot ||
      left.side !== right.side
    ) {
      return false
    }
  }
  for (let i = 0; i < a.grenades.length; i++) {
    const left = a.grenades[i]
    const right = b.grenades[i]
    if (
      !left ||
      !right ||
      left.id !== right.id ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.type !== right.type ||
      left.state !== right.state ||
      left.radius !== right.radius ||
      left.ownerSide !== right.ownerSide
    ) {
      return false
    }
  }
  return a.bomb?.x === b.bomb?.x && a.bomb?.y === b.bomb?.y && a.bomb?.kind === b.bomb?.kind
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
