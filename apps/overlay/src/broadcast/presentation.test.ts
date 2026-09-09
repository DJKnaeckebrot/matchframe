import { describe, expect, test } from "bun:test"
import type { GameState, PlayerState, Side } from "@workspace/game-state"
import { compactBroadcastConfig, defaultBroadcastConfig } from "@workspace/presentation"

import {
  applyBroadcastConfig,
  brandingSlots,
  formatWinReason,
  getOverlayPhase,
  overlayShow,
  overlaySponsor,
  parseOverlayBranding,
  parseSeriesFormat,
  pickInterstitial,
  portraitInitials,
  seriesSlots,
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

function state(overrides: Omit<Partial<GameState>, "map" | "round"> & {
  map?: Partial<GameState["map"]>
  round?: Partial<GameState["round"]>
} = {}): GameState {
  const players = overrides.players ?? [
    player({ steamId: "a", teamId: "northwind", side: "CT", name: "Nova", kills: 12 }),
    player({ steamId: "b", teamId: "northwind", side: "CT", name: "Ash", kills: 18 }),
    player({ steamId: "c", teamId: "redline", side: "T", name: "Viper", kills: 22 }),
  ]
  const { round: roundOverride, map: mapOverride, ...rest } = overrides
  return {
    timestamp: 1,
    map: { name: "de_inferno", phase: "live", round: 11, roundHistory: [], ...mapOverride },
    teams: [
      { id: "northwind", name: "Northwind", side: "CT", score: 8, seriesWins: 0 },
      { id: "redline", name: "Redline", side: "T", score: 6, seriesWins: 0 },
    ],
    players,
    observer: { playerSteamId: "a" },
    bomb: null,
    pause: null,
    worldGrenades: [],
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
  test("does not invent an event name", () => {
    expect(parseOverlayBranding("")).toEqual({})
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
        seriesLabel: "BO3",
      }).map((slot) => slot.id)
    ).toEqual(["event", "stage", "series"])
  })

  test("does not badge a single-map series", () => {
    expect(
      brandingSlots({ eventName: "Matchframe", seriesLabel: "BO1" }).map((slot) => slot.id)
    ).toEqual(["event"])
  })
})

describe("overlaySponsor", () => {
  test("hides when disabled even if name and logo exist", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsor: {
        enabled: false,
        name: "Local LAN",
        assetId: "sponsor-ab12",
        position: "center",
        displayMode: "logo-text",
      },
    })
    const branding = applyBroadcastConfig({}, config)
    expect(overlaySponsor(branding, config)).toBeUndefined()
    expect(overlayShow(state(), branding, config).sponsor).toBeUndefined()
  })

  test("places a text-only sponsor top-right", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsor: { enabled: true, name: "Local LAN", position: "top-right", displayMode: "text" },
    })
    const branding = applyBroadcastConfig({}, config)
    expect(overlaySponsor(branding, config)).toEqual({
      position: "top-right",
      displayMode: "text",
      name: "Local LAN",
      showLogo: false,
      showText: true,
    })
  })

  test("logo mode falls back to text when the asset id is invalid", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsor: {
        enabled: true,
        name: "Local LAN",
        assetId: "../secret",
        position: "center",
        displayMode: "logo",
      },
    })
    const branding = applyBroadcastConfig({}, config)
    expect(branding.sponsorImageUrl).toBeUndefined()
    expect(overlaySponsor(branding, config)).toEqual({
      position: "center",
      displayMode: "logo",
      name: "Local LAN",
      showLogo: false,
      showText: true,
    })
  })

  test("URL-only sponsor still appears when broadcast config has none", () => {
    expect(
      overlaySponsor({ sponsorName: "Local LAN" }, defaultBroadcastConfig)
    ).toEqual({
      position: "top-right",
      displayMode: "logo-text",
      name: "Local LAN",
      showLogo: false,
      showText: true,
    })
  })

  test("does not put sponsor in the event/stage meta slots", () => {
    expect(
      brandingSlots({
        eventName: "Matchframe",
        sponsorName: "Local LAN",
        seriesLabel: "BO3",
      }).map((slot) => slot.id)
    ).toEqual(["event", "series"])
  })
})

describe("applyBroadcastConfig", () => {
  test("fills series from overlay config when the URL omits it", () => {
    expect(applyBroadcastConfig({}, compactBroadcastConfig({
      format: "BO3",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    })).seriesLabel).toBe("BO3")
  })

  test("keeps an explicit URL series", () => {
    expect(
      applyBroadcastConfig({ seriesLabel: "BO5" }, compactBroadcastConfig({
        format: "BO3",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      })).seriesLabel
    ).toBe("BO5")
  })

  test("merges team names, event, and sponsor from broadcast config", () => {
    expect(
      applyBroadcastConfig({ seriesLabel: "BO5" }, compactBroadcastConfig({
        format: "BO3",
        teams: { left: { name: "FaZe" }, right: { name: "NaVi" } },
        series: { leftMapsWon: 1, rightMapsWon: 0 },
        event: { name: "DACH Masters", stage: "Semifinal" },
        sponsor: { name: "Local LAN" },
      }))
    ).toMatchObject({
      seriesLabel: "BO5",
      leftName: "FaZe",
      rightName: "NaVi",
      eventName: "DACH Masters",
      stage: "Semifinal",
      sponsorName: "Local LAN",
    })
  })

  test("empty event and sponsor stay omitted", () => {
    const branding = applyBroadcastConfig({}, defaultBroadcastConfig)
    expect(branding.eventName).toBeUndefined()
    expect(branding.sponsorName).toBeUndefined()
    expect(branding.sponsorImageUrl).toBeUndefined()
  })

  test("partial config without teams does not throw", () => {
    expect(applyBroadcastConfig({}, { format: "BO3" } as never).seriesLabel).toBe("BO3")
  })

  test("resolves local logo urls and omits missing logos", () => {
    const branding = applyBroadcastConfig(
      {},
      compactBroadcastConfig({
        format: "BO1",
        teams: { left: { logoAssetId: "team-left-ab12cd34" }, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      })
    )
    expect(branding.leftLogoUrl).toContain("/api/assets/team-left-ab12cd34")
    expect(branding.rightLogoUrl).toBeUndefined()
  })
})

describe("parseSeriesFormat", () => {
  const cases: Array<[string | undefined, ReturnType<typeof parseSeriesFormat>]> = [
    [undefined, undefined],
    ["Quarterfinal", undefined],
    ["BO1", { length: 1, winsNeeded: 1 }],
    ["bo3", { length: 3, winsNeeded: 2 }],
    ["Best of 5", { length: 5, winsNeeded: 3 }],
    ["7", { length: 7, winsNeeded: 4 }],
  ]
  for (const [label, expected] of cases) {
    test(String(label), () => {
      expect(parseSeriesFormat(label)).toEqual(expected)
    })
  }
})

describe("seriesSlots", () => {
  const bo3 = { length: 3 as const, winsNeeded: 2 }

  test("hides the rail for BO1 and unknown format", () => {
    expect(seriesSlots({ length: 1, winsNeeded: 1 }, 1)).toBeUndefined()
    expect(seriesSlots(undefined, 2)).toBeUndefined()
  })

  test("fills map marks up to wins needed", () => {
    expect(seriesSlots(bo3, 0)).toEqual([false, false])
    expect(seriesSlots(bo3, 1)).toEqual([true, false])
    expect(seriesSlots(bo3, 4)).toEqual([true, true])
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
    const show = overlayShow(state(), { eventName: "Matchframe" }, defaultBroadcastConfig)
    expect(show.chrome).toEqual({
      radar: true,
      header: true,
      teams: true,
      focused: true,
      result: false,
      history: false,
      interstitial: false,
    })
    expect(show.interstitial).toBeNull()
    expect(show.series).toBeUndefined()
  })

  test("exposes a series format from branding", () => {
    expect(overlayShow(state(), { seriesLabel: "BO3" }, defaultBroadcastConfig).series).toEqual({
      length: 3,
      winsNeeded: 2,
    })
  })

  test("replaces focused player with MVP when the round ends", () => {
    const show = overlayShow(
      state({
        round: { phase: "over", winTeam: "CT", winReason: "bomb_defused", alive: { ct: 2, t: 0 } },
      }),
      { eventName: "Matchframe" },
      defaultBroadcastConfig
    )
    expect(show.chrome.focused).toBe(false)
    expect(show.chrome.result).toBe(true)
    expect(show.chrome.history).toBe(true)
    expect(show.chrome.interstitial).toBe(true)
    expect(show.interstitial?.kind).toBe("mvp")
    expect(show.interstitial?.playerSteamId).toBe("b")
    expect(show.interstitial?.statValue).toBe("18")
  })

  test("MVP card uses overlay team names", () => {
    const show = overlayShow(
      state({
        round: { phase: "over", winTeam: "CT", winReason: "bomb_defused", alive: { ct: 2, t: 0 } },
      }),
      { eventName: "Matchframe" },
      compactBroadcastConfig({
        format: "BO1",
        teams: { left: { name: "FaZe" }, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      })
    )
    expect(show.interstitial?.teamName).toBe("FaZe")
  })

  test("shows round history before the round is live", () => {
    const freeze = overlayShow(
      state({ round: { phase: "freezetime", winTeam: null, alive: { ct: 5, t: 5 } } }),
      {},
      defaultBroadcastConfig
    )
    expect(freeze.chrome.history).toBe(true)

    const planted = overlayShow(
      state({ bomb: { state: "planted", countdown: 30 } }),
      {},
      defaultBroadcastConfig
    )
    expect(planted.chrome.history).toBe(false)
  })
})

describe("pickInterstitial", () => {
  test("does not invent MVP during live play", () => {
    expect(pickInterstitial(state(), "live", defaultBroadcastConfig)).toBeNull()
  })

  test("picks the winning side, not the global kill leader", () => {
    const card = pickInterstitial(
      state({ round: { phase: "over", winTeam: "CT", alive: { ct: 1, t: 0 } } }),
      "round_over",
      defaultBroadcastConfig
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
          { id: "northwind", name: "Northwind", side: "T" as Side, score: 9, seriesWins: 0 },
          { id: "redline", name: "Redline", side: "CT", score: 6, seriesWins: 0 },
        ],
        players: [
          player({ steamId: "a", teamId: "northwind", side: "T", name: "Nova", kills: 9 }),
          player({ steamId: "c", teamId: "redline", side: "CT", name: "Viper", kills: 30 }),
        ],
      }),
      "round_over",
      defaultBroadcastConfig
    )
    expect(card?.teamId).toBe("northwind")
    expect(card?.playerName).toBe("Nova")
  })
})
