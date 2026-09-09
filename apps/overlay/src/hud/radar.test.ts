import { describe, expect, test } from "bun:test"
import { DE_ANUBIS, DE_ANUBIS_OVERVIEW_SPAWNS, radarToWorld } from "@workspace/maps"
import type { GameState, PlayerState } from "@workspace/game-state"

import {
  getRadarBomb,
  getRadarGrenades,
  getRadarPlayers,
  RADAR_SMOKE_PRESENTATION_RADIUS,
} from "./radar"

function player(partial: Partial<PlayerState> & Pick<PlayerState, "steamId" | "side">): PlayerState {
  return {
    name: partial.name ?? partial.steamId,
    teamId: partial.side === "CT" ? "northwind" : "redline",
    alive: true,
    health: 100,
    armor: 100,
    money: 0,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: {
      grenades: [],
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
    },
    ...partial,
  }
}

function state(
  players: PlayerState[],
  bomb: GameState["bomb"] = null,
  worldGrenades: GameState["worldGrenades"] = []
): GameState {
  return {
    timestamp: 1,
    map: { name: "de_anubis", phase: "live", round: 0, roundHistory: [] },
    round: { phase: "live", winTeam: null, alive: { ct: 1, t: 1 } },
    teams: [
      { id: "northwind", name: "Northwind", side: "CT", score: 0, seriesWins: 0 },
      { id: "redline", name: "Redline", side: "T", score: 0, seriesWins: 0 },
    ],
    players,
    observer: { playerSteamId: "ct1" },
    bomb,
    pause: null,
    worldGrenades,
  }
}

describe("radar selectors", () => {
  test("returns alive players at overview spawn points and skips the dead", () => {
    const ctPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const tPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.t, DE_ANUBIS)
    const players = getRadarPlayers(
      state([
        player({
          steamId: "ct1",
          side: "CT",
          observerSlot: 1,
          position: { ...ctPos, z: 0 },
          forward: { x: 0, y: 1, z: 0 },
        }),
        player({
          steamId: "t1",
          side: "T",
          position: { ...tPos, z: 0 },
          forward: { x: 1, y: 0, z: 0 },
        }),
        player({
          steamId: "t2",
          side: "T",
          alive: false,
          health: 0,
          position: { ...tPos, z: 0 },
        }),
      ]),
      DE_ANUBIS
    )

    expect(players).toHaveLength(2)
    expect(players[0]).toMatchObject({
      steamId: "ct1",
      side: "CT",
      observed: true,
      angle: 0,
      slot: 1,
    })
    expect(players[0]?.x).toBeCloseTo(DE_ANUBIS_OVERVIEW_SPAWNS.ct.x, 10)
    expect(players[1]?.angle).toBeCloseTo(90, 10)
    expect(players.some((entry) => entry.steamId === "t2")).toBe(false)
  })

  test("derives a carried bomb from the carrier when BombState has no position", () => {
    const tPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.t, DE_ANUBIS)
    const bomb = getRadarBomb(
      state(
        [player({ steamId: "t1", side: "T", position: { ...tPos, z: 0 } })],
        { state: "carried", carrierSteamId: "t1" }
      ),
      DE_ANUBIS
    )
    expect(bomb?.kind).toBe("carried")
    expect(bomb?.x).toBeCloseTo(DE_ANUBIS_OVERVIEW_SPAWNS.t.x, 10)
  })

  test("planted bomb uses BombState.position", () => {
    const ctPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const bomb = getRadarBomb(
      state([], { state: "planted", position: { ...ctPos, z: 0 } }),
      DE_ANUBIS
    )
    expect(bomb).toMatchObject({ kind: "planted" })
    expect(bomb?.x).toBeCloseTo(DE_ANUBIS_OVERVIEW_SPAWNS.ct.x, 10)
  })

  test("radar blob uses team roster number 1–5, not keyboard 6–10", () => {
    const ctPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const tPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.t, DE_ANUBIS)
    const players = getRadarPlayers(
      state([
        player({
          steamId: "ct1",
          side: "CT",
          observerSlot: 1,
          position: { ...ctPos, z: 0 },
        }),
        player({
          steamId: "t1",
          side: "T",
          observerSlot: 6,
          position: { ...tPos, z: 0 },
        }),
        player({
          steamId: "t2",
          side: "T",
          observerSlot: 0,
          position: { ...tPos, z: 0 },
        }),
      ]),
      DE_ANUBIS
    )
    expect(players.find((entry) => entry.steamId === "ct1")?.slot).toBe(1)
    expect(players.find((entry) => entry.steamId === "t1")?.slot).toBe(1)
    expect(players.find((entry) => entry.steamId === "t2")?.slot).toBe(2)
  })

  test("transforms smoke world position and marks effectTime>0 as active", () => {
    const mid = radarToWorld({ x: 0.47, y: 0.48 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [
        {
          id: "401",
          type: "smoke",
          ownerSteamId: "t1",
          position: { ...mid, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          effectTime: 2.1,
        },
      ]),
      DE_ANUBIS
    )
    expect(grenades).toHaveLength(1)
    expect(grenades[0]).toMatchObject({
      id: "401",
      type: "smoke",
      state: "active",
    })
    expect(grenades[0]?.x).toBeCloseTo(0.47, 10)
    expect(grenades[0]?.y).toBeCloseTo(0.48, 10)
    expect(grenades[0]?.radius).toBeCloseTo(
      RADAR_SMOKE_PRESENTATION_RADIUS / (DE_ANUBIS.radar.scale * DE_ANUBIS.radar.width),
      10
    )
  })

  test("in-flight smoke stays a projectile without an area radius", () => {
    const pos = radarToWorld({ x: 0.56, y: 0.78 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [
        {
          id: "401",
          type: "smoke",
          position: { ...pos, z: 0 },
          velocity: { x: 40, y: 280, z: 20 },
          effectTime: 0,
        },
      ]),
      DE_ANUBIS
    )
    expect(grenades[0]?.state).toBe("projectile")
    expect(grenades[0]?.radius).toBeUndefined()
  })

  test("owner side comes from current PlayerState, not the grenade", () => {
    const pos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.t, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state(
        [player({ steamId: "t1", side: "T" })],
        null,
        [{ id: "401", type: "smoke", ownerSteamId: "t1", position: { ...pos, z: 0 }, effectTime: 1 }]
      ),
      DE_ANUBIS
    )
    expect(grenades[0]?.ownerSide).toBe("T")
    expect(grenades[0]?.ownerSteamId).toBe("t1")
  })

  test("missing owner renders without side", () => {
    const pos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [{ id: "9", type: "smoke", position: { ...pos, z: 0 }, effectTime: 1 }]),
      DE_ANUBIS
    )
    expect(grenades[0]?.ownerSide).toBeUndefined()
    expect(grenades[0]?.ownerSteamId).toBeUndefined()
  })

  test("keeps simultaneous smokes as independent entities", () => {
    const a = radarToWorld({ x: 0.47, y: 0.48 }, DE_ANUBIS)
    const b = radarToWorld({ x: 0.72, y: 0.28 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [
        { id: "401", type: "smoke", position: { ...a, z: 0 }, effectTime: 2 },
        { id: "402", type: "smoke", position: { ...b, z: 0 }, effectTime: 3 },
      ]),
      DE_ANUBIS
    )
    expect(grenades.map((entry) => entry.id)).toEqual(["401", "402"])
    expect(grenades[0]?.x).toBeCloseTo(0.47, 10)
    expect(grenades[1]?.x).toBeCloseTo(0.72, 10)
  })

  test("keeps non-smoke world grenades in the selector for later types", () => {
    const pos = radarToWorld({ x: 0.4, y: 0.4 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [{ id: "8", type: "flash", position: { ...pos, z: 0 } }]),
      DE_ANUBIS
    )
    expect(grenades[0]).toMatchObject({ id: "8", type: "flash", state: "projectile" })
  })

  test("unknown world grenades still convert and do not throw", () => {
    const pos = radarToWorld({ x: 0.4, y: 0.4 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [{ id: "9", type: "unknown", position: { ...pos, z: 0 } }]),
      DE_ANUBIS
    )
    expect(grenades[0]).toMatchObject({ id: "9", type: "unknown", state: "projectile" })
  })
})
