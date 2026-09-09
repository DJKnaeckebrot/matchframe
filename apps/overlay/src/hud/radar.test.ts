import { describe, expect, test } from "bun:test"
import { DE_ANUBIS, DE_ANUBIS_OVERVIEW_SPAWNS, DE_NUKE, radarToWorld } from "@workspace/maps"
import type { GameState, PlayerState } from "@workspace/game-state"

import {
  getRadarBomb,
  getRadarFloor,
  getRadarGrenades,
  getRadarPlayers,
  RADAR_FLAME_PRESENTATION_RADIUS,
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
  worldGrenades: GameState["worldGrenades"] = [],
  mapName = "de_anubis"
): GameState {
  return {
    timestamp: 1,
    map: { name: mapName, phase: "live", round: 0, roundHistory: [] },
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

  test("HE, flash, and decoy stay projectiles with owner side from PlayerState", () => {
    const he = radarToWorld({ x: 0.52, y: 0.7 }, DE_ANUBIS)
    const flash = radarToWorld({ x: 0.45, y: 0.62 }, DE_ANUBIS)
    const decoy = radarToWorld({ x: 0.4, y: 0.5 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state(
        [player({ steamId: "t1", side: "T" }), player({ steamId: "ct1", side: "CT" })],
        null,
        [
          { id: "he1", type: "he", ownerSteamId: "t1", position: { ...he, z: 0 } },
          { id: "fl1", type: "flash", ownerSteamId: "ct1", position: { ...flash, z: 0 } },
          { id: "de1", type: "decoy", ownerSteamId: "t1", position: { ...decoy, z: 0 } },
        ]
      ),
      DE_ANUBIS
    )
    expect(grenades).toEqual([
      expect.objectContaining({ id: "he1", type: "he", state: "projectile", ownerSide: "T" }),
      expect.objectContaining({ id: "fl1", type: "flash", state: "projectile", ownerSide: "CT" }),
      expect.objectContaining({ id: "de1", type: "decoy", state: "projectile", ownerSide: "T" }),
    ])
    expect(grenades[0]?.x).toBeCloseTo(0.52, 10)
    expect(grenades[1]?.x).toBeCloseTo(0.45, 10)
    expect(grenades[2]?.x).toBeCloseTo(0.4, 10)
  })

  test("firebomb projectile has no flame area until flames exist", () => {
    const pos = radarToWorld({ x: 0.58, y: 0.72 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state(
        [player({ steamId: "ct1", side: "CT" })],
        null,
        [{ id: "fb1", type: "molotov", ownerSteamId: "ct1", position: { ...pos, z: 0 } }]
      ),
      DE_ANUBIS
    )
    expect(grenades[0]).toMatchObject({
      id: "fb1",
      type: "molotov",
      state: "projectile",
      ownerSide: "CT",
    })
    expect(grenades[0]?.flamePoints).toBeUndefined()
    expect(grenades[0]?.radius).toBeUndefined()
  })

  test("transforms inferno flame world positions and does not reuse a smoke circle", () => {
    const origin = radarToWorld({ x: 0.5, y: 0.45 }, DE_ANUBIS)
    const a = radarToWorld({ x: 0.5, y: 0.45 }, DE_ANUBIS)
    const b = radarToWorld({ x: 0.52, y: 0.46 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state(
        [player({ steamId: "t1", side: "T" })],
        null,
        [
          {
            id: "inf1",
            type: "molotov",
            ownerSteamId: "t1",
            position: { ...origin, z: 0 },
            flames: [
              { ...a, z: 0 },
              { ...b, z: 0 },
            ],
          },
        ]
      ),
      DE_ANUBIS
    )
    expect(grenades[0]?.state).toBe("active")
    expect(grenades[0]?.ownerSide).toBe("T")
    expect(grenades[0]?.flamePoints).toHaveLength(2)
    expect(grenades[0]?.flamePoints?.[0]?.x).toBeCloseTo(0.5, 10)
    expect(grenades[0]?.flamePoints?.[0]?.y).toBeCloseTo(0.45, 10)
    expect(grenades[0]?.flamePoints?.[1]?.x).toBeCloseTo(0.52, 10)
    expect(grenades[0]?.radius).toBeCloseTo(
      RADAR_FLAME_PRESENTATION_RADIUS / (DE_ANUBIS.radar.scale * DE_ANUBIS.radar.width),
      10
    )
    expect(grenades[0]?.radius).not.toBeCloseTo(
      RADAR_SMOKE_PRESENTATION_RADIUS / (DE_ANUBIS.radar.scale * DE_ANUBIS.radar.width),
      5
    )
  })

  test("skips flame points that cannot transform and keeps the grenade", () => {
    const pos = radarToWorld({ x: 0.5, y: 0.5 }, DE_ANUBIS)
    const good = radarToWorld({ x: 0.51, y: 0.5 }, DE_ANUBIS)
    const grenades = getRadarGrenades(
      state([], null, [
        {
          id: "inf2",
          type: "molotov",
          position: { ...pos, z: 0 },
          flames: [{ ...good, z: 0 }, { x: Number.NaN, y: 0, z: 0 }],
        },
      ]),
      DE_ANUBIS
    )
    expect(grenades[0]?.flamePoints).toHaveLength(1)
    expect(grenades[0]?.flamePoints?.[0]?.x).toBeCloseTo(0.51, 10)
  })

  test("mixed smoke, fire, projectile, and players stay independent layer data", () => {
    const smokePos = radarToWorld({ x: 0.47, y: 0.48 }, DE_ANUBIS)
    const firePos = radarToWorld({ x: 0.5, y: 0.45 }, DE_ANUBIS)
    const hePos = radarToWorld({ x: 0.52, y: 0.7 }, DE_ANUBIS)
    const ctPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const flame = radarToWorld({ x: 0.505, y: 0.45 }, DE_ANUBIS)
    const game = state(
      [player({ steamId: "ct1", side: "CT", position: { ...ctPos, z: 0 } })],
      { state: "planted", position: { ...ctPos, z: 0 } },
      [
        { id: "401", type: "smoke", position: { ...smokePos, z: 0 }, effectTime: 2 },
        {
          id: "inf1",
          type: "molotov",
          position: { ...firePos, z: 0 },
          flames: [{ ...flame, z: 0 }],
        },
        { id: "he1", type: "he", position: { ...hePos, z: 0 } },
      ]
    )
    const players = getRadarPlayers(game, DE_ANUBIS)
    const bomb = getRadarBomb(game, DE_ANUBIS)
    const grenades = getRadarGrenades(game, DE_ANUBIS)
    expect(players).toHaveLength(1)
    expect(bomb?.kind).toBe("planted")
    expect(grenades.map((entry) => [entry.id, entry.state, entry.type])).toEqual([
      ["401", "active", "smoke"],
      ["inf1", "active", "molotov"],
      ["he1", "projectile", "he"],
    ])
    expect(grenades[0]?.flamePoints).toBeUndefined()
    expect(grenades[1]?.flamePoints).toHaveLength(1)
  })

  test("Anubis markers are always on-level", () => {
    const ctPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const players = getRadarPlayers(
      state([player({ steamId: "ct1", side: "CT", position: { ...ctPos, z: -800 } })]),
      DE_ANUBIS
    )
    expect(players[0]?.onLevel).toBe(true)
    expect(getRadarFloor(state([]), DE_ANUBIS)).toBeUndefined()
  })

  test("Nuke radar floor follows the observed player Z", () => {
    const upper = radarToWorld({ x: 0.5, y: 0.5 }, DE_NUKE)
    const game = state(
      [
        player({
          steamId: "ct1",
          side: "CT",
          position: { ...upper, z: 100 },
        }),
        player({
          steamId: "t1",
          side: "T",
          position: { ...upper, z: -800 },
        }),
      ],
      null,
      [],
      "de_nuke"
    )
    expect(getRadarFloor(game, DE_NUKE)?.id).toBe("default")
    const players = getRadarPlayers(game, DE_NUKE)
    expect(players.find((entry) => entry.steamId === "ct1")?.onLevel).toBe(true)
    expect(players.find((entry) => entry.steamId === "t1")?.onLevel).toBe(false)
  })

  test("Nuke lower floor follows an observed player underground", () => {
    const pos = radarToWorld({ x: 0.58, y: 0.58 }, DE_NUKE)
    const game = state(
      [
        player({
          steamId: "ct1",
          side: "CT",
          position: { ...pos, z: -800 },
        }),
      ],
      { state: "planted", position: { ...pos, z: -800 } },
      [{ id: "401", type: "smoke", position: { ...pos, z: 80 }, effectTime: 2 }],
      "de_nuke"
    )
    expect(getRadarFloor(game, DE_NUKE)?.id).toBe("lower")
    expect(getRadarPlayers(game, DE_NUKE)[0]?.onLevel).toBe(true)
    expect(getRadarBomb(game, DE_NUKE)?.onLevel).toBe(true)
    expect(getRadarGrenades(game, DE_NUKE)[0]?.onLevel).toBe(false)
  })
})
