import { describe, expect, test } from "bun:test"
import type { GameState, PlayerState } from "@workspace/game-state"

import { interstitialLayout, interstitialSide } from "./interstitial"

describe("interstitialLayout", () => {
  test("round winner is the compact team slate", () => {
    expect(interstitialLayout("round-winner")).toEqual({
      size: "compact",
      composition: "team",
      emphasis: "none",
    })
  })

  test("MVP is a medium player card", () => {
    expect(interstitialLayout("mvp")).toEqual({
      size: "medium",
      composition: "player",
      emphasis: "none",
    })
  })

  test("ACE emphasizes the achievement label", () => {
    expect(interstitialLayout("ace")).toEqual({
      size: "emphasis",
      composition: "player",
      emphasis: "label",
    })
  })

  test("clutch emphasizes the 1vX ratio", () => {
    expect(interstitialLayout("clutch")).toEqual({
      size: "emphasis",
      composition: "player",
      emphasis: "ratio",
    })
  })
})

describe("interstitialSide", () => {
  test("keeps the pinned MVP side when speccing the other team after a side switch", () => {
    expect(
      interstitialSide(swappedState(), {
        type: "mvp",
        id: "mvp:12:jabbi",
        createdAt: 1,
        teamId: "northwind",
        playerSteamId: "jabbi",
        roundKills: 1,
        side: "CT",
      })
    ).toBe("CT")
  })

  test("does not follow the observed player", () => {
    expect(
      interstitialSide(swappedState(), {
        type: "round-winner",
        id: "round-winner:12:northwind",
        createdAt: 1,
        teamId: "northwind",
        side: "CT",
      })
    ).toBe("CT")
  })
})

function swappedState(): GameState {
  return {
    timestamp: 1,
    map: { name: "de_mirage", phase: "live", round: 12, roundHistory: [] },
    round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 } },
    teams: [
      { id: "northwind", name: "Northwind", side: "T", score: 6, seriesWins: 0 },
      { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
    ],
    players: [
      player("jabbi", "northwind", "T"),
      player("phzy", "redline", "CT"),
    ],
    observer: { playerSteamId: "phzy" },
    bomb: null,
    pause: null,
    worldGrenades: [],
  }
}

function player(steamId: string, teamId: string, side: PlayerState["side"]): PlayerState {
  return {
    steamId,
    name: steamId,
    teamId,
    side,
    alive: true,
    health: 100,
    armor: 0,
    money: 800,
    kills: 0,
    assists: 0,
    deaths: 0,
    equipment: { grenades: [], hasHelmet: false, hasDefuseKit: false, hasBomb: false },
  }
}
