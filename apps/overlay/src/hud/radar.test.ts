import { describe, expect, test } from "bun:test"
import { DE_ANUBIS, DE_ANUBIS_OVERVIEW_SPAWNS, radarToWorld } from "@workspace/maps"
import type { GameState, PlayerState } from "@workspace/game-state"

import { getRadarBomb, getRadarPlayers } from "./radar"

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

function state(players: PlayerState[], bomb: GameState["bomb"] = null): GameState {
  return {
    timestamp: 1,
    map: { name: "de_anubis", phase: "live", round: 0 },
    round: { phase: "live", winTeam: null, alive: { ct: 1, t: 1 } },
    teams: [
      { id: "northwind", name: "Northwind", side: "CT", score: 0 },
      { id: "redline", name: "Redline", side: "T", score: 0 },
    ],
    players,
    observer: { playerSteamId: "ct1" },
    bomb,
    pause: null,
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

  test("observer slot 0 becomes radar label 10", () => {
    const ctPos = radarToWorld(DE_ANUBIS_OVERVIEW_SPAWNS.ct, DE_ANUBIS)
    const players = getRadarPlayers(
      state([
        player({
          steamId: "ct1",
          side: "CT",
          observerSlot: 0,
          position: { ...ctPos, z: 0 },
        }),
      ]),
      DE_ANUBIS
    )
    expect(players[0]?.slot).toBe(10)
  })
})
