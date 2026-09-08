import { describe, expect, test } from "bun:test"
import type { GameState, PlayerState, Side } from "@workspace/game-state"

import {
  brandingSlots,
  formatWinReason,
  getOverlayPhase,
  overlayShow,
  parseOverlayBranding,
  pickInterstitial,
  portraitInitials,
} from "./presentation"

function player(
  partial: Partial<PlayerState> & Pick<PlayerState, "steamId" | "teamId" | "side">
): PlayerState {
  return {
    name: partial.name ?? partial.steamId,
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

function state(overrides: Partial<GameState> = {}): GameState {
  const players = overrides.players ?? [
    player({ steamId: "a", teamId: "northwind", side: "CT", name: "Nova", kills: 12 }),
    player({ steamId: "b", teamId: "northwind", side: "CT", name: "Ash", kills: 18 }),
    player({ steamId: "c", teamId: "redline", side: "T", name: "Viper", kills: 22 }),
  ]
  const { round: roundOverride, ...rest } = overrides
  return {
    timestamp: 1,
    map: { name: "de_inferno", phase: "live", round: 11 },
    teams: [
      { id: "northwind", name: "Northwind", side: "CT", score: 8 },
      { id: "redline", name: "Redline", side: "T", score: 6 },
    ],
    players,
    observer: { playerSteamId: "a" },
    bomb: null,
    pause: null,
    ...rest,
    round: {
      phase: "live",
      winTeam: null,
      alive: { ct: 5, t: 5 },
      ...roundOverride,
    },
  }
}

describe("parseOverlayBranding", () => {
  test("defaults the event slot to Matchframe", () => {
    expect(parseOverlayBranding("")).toEqual({ eventName: "Matchframe" })
  })

  test("reads configurable slots from the overlay URL", () => {
    expect(
      parseOverlayBranding(
        "?event=Open%20Cup&stage=Decider&sponsor=Local%20LAN&series=BO3&eventImage=https://cdn.example/event.png"
      )
    ).toEqual({
      eventName: "Open Cup",
      eventImageUrl: "https://cdn.example/event.png",
      stage: "Decider",
      sponsorName: "Local LAN",
      seriesLabel: "BO3",
    })
  })

  test("empty event param hides the default name", () => {
    expect(parseOverlayBranding("?event=").eventName).toBeUndefined()
  })

  test("rejects non-http image URLs", () => {
    expect(parseOverlayBranding("?eventImage=javascript:alert(1)").eventImageUrl).toBeUndefined()
    expect(parseOverlayBranding("?sponsorImage=/local/sponsor.svg").sponsorImageUrl).toBe("/local/sponsor.svg")
  })
})

describe("brandingSlots", () => {
  test("drops empty slots and keeps order", () => {
    expect(
      brandingSlots({
        eventName: "Matchframe",
        stage: "Semifinal",
        sponsorName: undefined,
        seriesLabel: "BO1",
      }).map((slot) => slot.id)
    ).toEqual(["event", "stage", "series"])
  })
})

describe("getOverlayPhase", () => {
  const cases: Array<{ name: string; phase: ReturnType<typeof getOverlayPhase>; game: GameState }> = [
    { name: "live", phase: "live", game: state() },
    {
      name: "freeze",
      phase: "freeze",
      game: state({ round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 } } }),
    },
    {
      name: "planted",
      phase: "planted",
      game: state({ bomb: { state: "planted", countdown: 30 } }),
    },
    {
      name: "defusing",
      phase: "defusing",
      game: state({ bomb: { state: "defusing", countdown: 22, defuseCountdown: 4 } }),
    },
    {
      name: "round over",
      phase: "round_over",
      game: state({ round: { phase: "over", winTeam: "CT", alive: { ct: 2, t: 0 } } }),
    },
    {
      name: "paused",
      phase: "paused",
      game: state({ pause: { kind: "paused", timeRemaining: 20 } }),
    },
    {
      name: "timeout",
      phase: "timeout",
      game: state({ pause: { kind: "timeout", side: "T", timeRemaining: 30 } }),
    },
  ]

  for (const row of cases) {
    test(row.name, () => {
      expect(getOverlayPhase(row.game)).toBe(row.phase)
    })
  }
})

describe("overlayShow", () => {
  test("keeps focused player during live play", () => {
    const show = overlayShow(state(), { eventName: "Matchframe" })
    expect(show.chrome).toEqual({
      radar: true,
      header: true,
      teams: true,
      focused: true,
      result: false,
      interstitial: false,
    })
    expect(show.interstitial).toBeNull()
  })

  test("replaces focused player with MVP when the round ends", () => {
    const show = overlayShow(
      state({
        round: { phase: "over", winTeam: "CT", winReason: "bomb_defused", alive: { ct: 2, t: 0 } },
      }),
      { eventName: "Matchframe" }
    )
    expect(show.chrome.focused).toBe(false)
    expect(show.chrome.result).toBe(true)
    expect(show.chrome.interstitial).toBe(true)
    expect(show.interstitial?.kind).toBe("mvp")
    expect(show.interstitial?.playerSteamId).toBe("b")
    expect(show.interstitial?.statValue).toBe("18")
  })
})

describe("pickInterstitial", () => {
  test("does not invent MVP during live play", () => {
    expect(pickInterstitial(state(), "live")).toBeNull()
  })

  test("picks the winning side, not the global kill leader", () => {
    const card = pickInterstitial(
      state({ round: { phase: "over", winTeam: "CT", alive: { ct: 1, t: 0 } } }),
      "round_over"
    )
    expect(card?.playerName).toBe("Ash")
    expect(card?.headline).toBe("MVP")
    expect(card?.side).toBe("CT")
  })
})

describe("portraits", () => {
  test("initials from name, then roster number", () => {
    expect(portraitInitials("Ash Vale")).toBe("AV")
    expect(portraitInitials("s1mple")).toBe("S1")
    expect(portraitInitials("", 3)).toBe("3")
  })
})

describe("formatWinReason", () => {
  const cases: Array<[Parameters<typeof formatWinReason>[0], string | undefined]> = [
    ["elimination", "ELIMINATION"],
    ["bomb_exploded", "BOMB"],
    ["bomb_defused", "DEFUSED"],
    ["time_expired", "TIME"],
    [undefined, undefined],
  ]
  for (const [reason, label] of cases) {
    test(String(reason), () => {
      expect(formatWinReason(reason)).toBe(label)
    })
  }
})

describe("side", () => {
  test("keeps logical team identity on the MVP card after a switch", () => {
    const card = pickInterstitial(
      state({
        round: { phase: "over", winTeam: "T", alive: { ct: 0, t: 2 } },
        teams: [
          { id: "northwind", name: "Northwind", side: "T" as Side, score: 9 },
          { id: "redline", name: "Redline", side: "CT", score: 6 },
        ],
        players: [
          player({ steamId: "a", teamId: "northwind", side: "T", name: "Nova", kills: 9 }),
          player({ steamId: "c", teamId: "redline", side: "CT", name: "Viper", kills: 30 }),
        ],
      }),
      "round_over"
    )
    expect(card?.teamId).toBe("northwind")
    expect(card?.playerName).toBe("Nova")
  })
})
