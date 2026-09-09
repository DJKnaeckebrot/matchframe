import { describe, expect, test } from "bun:test"

import {
  broadcastConfigSchema,
  clampSeriesMapsWon,
  compactBroadcastConfig,
  defaultBroadcastConfig,
  getSeriesWinTarget,
  overlaySeriesWins,
  overlaySeriesWinsChanged,
  overlayTeamName,
  parseBroadcastConfig,
  referencedAssetIds,
  resolveBroadcastEvent,
  resolveBroadcastSponsor,
  resolveBroadcastSponsors,
  resolveBroadcastTeam,
  resolveSponsorContent,
  seriesWinsNeeded,
  sponsorNeedsContent,
} from "./broadcast-config"

describe("broadcastConfigSchema", () => {
  test("defaults to a single map with empty presentation", () => {
    expect(defaultBroadcastConfig).toEqual({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    })
  })

  test("accepts nested broadcast config", () => {
    expect(
      parseBroadcastConfig({
        format: "BO3",
        teams: { left: { name: " Northwind " }, right: { name: "Redline" } },
        series: { leftMapsWon: 1, rightMapsWon: 0 },
        event: { name: " DACH Masters ", stage: "Semifinal" },
        sponsor: { name: "Local LAN", assetId: "sponsor-ab12" },
      })
    ).toEqual({
      success: true,
      data: {
        format: "BO3",
        teams: { left: { name: "Northwind" }, right: { name: "Redline" } },
        series: { leftMapsWon: 1, rightMapsWon: 0 },
        event: { name: "DACH Masters", stage: "Semifinal" },
        sponsors: [
          {
            enabled: true,
            name: "Local LAN",
            assetId: "sponsor-ab12",
            position: "top-right",
            displayMode: "logo-text",
          },
        ],
      },
    })
  })

  test("migrates legacy overlay.json", () => {
    expect(
      parseBroadcastConfig({
        series: "BO3",
        leftName: " FaZe ",
        rightName: "NaVi",
        leftWins: 1,
        rightWins: 0,
      })
    ).toEqual({
      success: true,
      data: {
        format: "BO3",
        teams: { left: { name: "FaZe" }, right: { name: "NaVi" } },
        series: { leftMapsWon: 1, rightMapsWon: 0 },
      },
    })
  })

  test("rejects unknown formats, remote logos, and overlong names", () => {
    expect(parseBroadcastConfig({ format: "BO2" }).success).toBe(false)
    expect(parseBroadcastConfig({}).success).toBe(false)
    expect(parseBroadcastConfig({ series: "BO2" }).success).toBe(false)
    expect(
      parseBroadcastConfig({ format: "BO1", teams: { left: { name: "n".repeat(33) } } }).success
    ).toBe(false)
    expect(
      parseBroadcastConfig({
        format: "BO3",
        teams: { left: { logoAssetId: "https://cdn.example/a.png" } },
      }).success
    ).toBe(false)
    expect(
      parseBroadcastConfig({ format: "BO3", series: { leftMapsWon: 5, rightMapsWon: 0 } }).success
    ).toBe(false)
  })

  test("zod schema round-trips nested config", () => {
    const parsed = broadcastConfigSchema.parse({ format: "BO5" })
    expect(parsed.format).toBe("BO5")
    expect(parsed.series).toEqual({ leftMapsWon: 0, rightMapsWon: 0 })
  })
})

describe("compactBroadcastConfig", () => {
  test("drops blank names and empty event/sponsor", () => {
    expect(
      compactBroadcastConfig({
        format: "BO3",
        teams: { left: { name: "" }, right: { name: "Redline" } },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
        event: { name: "  ", stage: "" },
        sponsor: { name: " " },
      })
    ).toEqual({
      format: "BO3",
      teams: { left: {}, right: { name: "Redline" } },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    })
  })

  test("clamps map wins to the series and clears them on BO1", () => {
    expect(
      compactBroadcastConfig({
        format: "BO3",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 4, rightMapsWon: 1 },
      })
    ).toEqual({
      format: "BO3",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 2, rightMapsWon: 1 },
    })
    expect(
      compactBroadcastConfig({
        format: "BO1",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 1, rightMapsWon: 0 },
      })
    ).toEqual({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    })
  })

  test("BO5 to BO3 clamps a 3-map lead", () => {
    expect(clampSeriesMapsWon("BO3", 3)).toBe(2)
    expect(
      compactBroadcastConfig({
        format: "BO3",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 3, rightMapsWon: 2 },
      }).series
    ).toEqual({ leftMapsWon: 2, rightMapsWon: 2 })
  })
})

describe("series helpers", () => {
  test("win target is first-to", () => {
    expect(getSeriesWinTarget("BO1")).toBe(1)
    expect(getSeriesWinTarget("BO3")).toBe(2)
    expect(getSeriesWinTarget("BO5")).toBe(3)
    expect(getSeriesWinTarget("BO7")).toBe(4)
  })

  test("mark count hides BO1", () => {
    expect(seriesWinsNeeded("BO1")).toBe(0)
    expect(seriesWinsNeeded("BO3")).toBe(2)
    expect(seriesWinsNeeded("BO5")).toBe(3)
    expect(seriesWinsNeeded("BO7")).toBe(4)
  })

  test("series change detection ignores names", () => {
    const a = compactBroadcastConfig({
      format: "BO3",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 1, rightMapsWon: 0 },
    })
    const renamed = compactBroadcastConfig({
      ...a,
      teams: { left: { name: "FaZe" }, right: {} },
    })
    expect(overlaySeriesWins(a)).toEqual({ left: 1, right: 0 })
    expect(overlaySeriesWinsChanged(a, renamed)).toBe(false)
    expect(
      overlaySeriesWinsChanged(a, {
        ...a,
        series: { leftMapsWon: 0, rightMapsWon: 0 },
      })
    ).toBe(true)
  })
})

describe("overlayTeamName", () => {
  test("uses the override when set, otherwise the in-game name", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: { name: "FaZe" }, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
    })
    expect(overlayTeamName(config, "left", "CT")).toBe("FaZe")
    expect(overlayTeamName(config, "right", "Redline")).toBe("Redline")
    expect(overlayTeamName(undefined, "left", "Northwind")).toBe("Northwind")
  })
})

describe("resolveBroadcastTeam", () => {
  const teams = [
    { id: "northwind", name: "Northwind", side: "CT" as const, score: 8 },
    { id: "redline", name: "Redline", side: "T" as const, score: 6 },
  ]

  test("blank name falls back to GSI, configured name overrides", () => {
    expect(resolveBroadcastTeam(teams, defaultBroadcastConfig, "left").displayName).toBe(
      "Northwind"
    )
    const named = compactBroadcastConfig({
      format: "BO3",
      teams: { left: { name: "FaZe", logoAssetId: "team-left-ab12" }, right: {} },
      series: { leftMapsWon: 1, rightMapsWon: 0 },
    })
    expect(resolveBroadcastTeam(teams, named, "left")).toMatchObject({
      displayName: "FaZe",
      logoAssetId: "team-left-ab12",
      mapsWon: 1,
      side: "CT",
      score: 8,
    })
  })

  test("side switch does not move configured logos or names", () => {
    const config = compactBroadcastConfig({
      format: "BO3",
      teams: {
        left: { name: "FaZe", logoAssetId: "team-left-ab12" },
        right: { name: "NaVi", logoAssetId: "team-right-cd34" },
      },
      series: { leftMapsWon: 2, rightMapsWon: 1 },
    })
    const swapped = [
      { id: "northwind", name: "Northwind", side: "T" as const, score: 9 },
      { id: "redline", name: "Redline", side: "CT" as const, score: 6 },
    ]
    const left = resolveBroadcastTeam(swapped, config, "left")
    const right = resolveBroadcastTeam(swapped, config, "right")
    expect(left).toMatchObject({
      displayName: "FaZe",
      logoAssetId: "team-left-ab12",
      side: "T",
      mapsWon: 2,
    })
    expect(right).toMatchObject({
      displayName: "NaVi",
      logoAssetId: "team-right-cd34",
      side: "CT",
      mapsWon: 1,
    })
  })

  test("missing teams still produce a usable fallback", () => {
    const resolved = resolveBroadcastTeam([], defaultBroadcastConfig, "left")
    expect(resolved.displayName).toBe("Left")
    expect(resolved.logoAssetId).toBeUndefined()
    expect(resolved.score).toBe(0)
  })

  test("legacy or partial config without teams/series does not throw", () => {
    const resolved = resolveBroadcastTeam(teams, { format: "BO1" } as never, "left")
    expect(resolved.displayName).toBe("Northwind")
    expect(resolved.mapsWon).toBe(0)
  })
})

describe("optional event and sponsor", () => {
  test("omits empty event and sponsor", () => {
    expect(resolveBroadcastEvent(defaultBroadcastConfig)).toBeUndefined()
    expect(resolveBroadcastSponsor(defaultBroadcastConfig)).toBeUndefined()
  })

  test("returns configured event and sponsor", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      event: { name: "Matchframe Cup", stage: "Semifinal" },
      sponsor: { name: "Local LAN", assetId: "sponsor-ab12" },
    })
    expect(resolveBroadcastEvent(config)).toEqual({
      name: "Matchframe Cup",
      stage: "Semifinal",
    })
    expect(resolveBroadcastSponsor(config)).toEqual({
      name: "Local LAN",
      assetId: "sponsor-ab12",
      position: "top-right",
      displayMode: "logo-text",
      showLogo: true,
      showText: true,
    })
    expect(referencedAssetIds(config)).toEqual(["sponsor-ab12"])
  })
})

describe("sponsor presentation", () => {
  test("legacy name/logo is enabled top-right logo-text", () => {
    expect(
      parseBroadcastConfig({
        format: "BO1",
        sponsor: { name: "Local LAN", assetId: "sponsor-ab12" },
      })
    ).toMatchObject({
      success: true,
      data: {
        sponsors: [
          {
            enabled: true,
            name: "Local LAN",
            assetId: "sponsor-ab12",
            position: "top-right",
            displayMode: "logo-text",
          },
        ],
      },
    })
  })

  test("keeps disabled sponsor with placement choices", () => {
    expect(
      compactBroadcastConfig({
        format: "BO1",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
        sponsor: {
          enabled: false,
          name: "Local LAN",
          position: "center",
          displayMode: "logo",
        },
      }).sponsors
    ).toEqual([
      {
        enabled: false,
        name: "Local LAN",
        position: "center",
        displayMode: "logo",
      },
    ])
  })

  test("invalid position, mode, and asset id fall back without dropping the rest", () => {
    expect(
      parseBroadcastConfig({
        format: "BO1",
        sponsor: {
          enabled: true,
          name: "Local LAN",
          assetId: "https://cdn.example/x.png",
          position: "left",
          displayMode: "banner",
        },
      })
    ).toEqual({
      success: true,
      data: {
        format: "BO1",
        teams: { left: {}, right: {} },
        series: { leftMapsWon: 0, rightMapsWon: 0 },
        sponsors: [
          {
            enabled: true,
            name: "Local LAN",
            position: "top-right",
            displayMode: "logo-text",
          },
        ],
      },
    })
  })

  test("disabled sponsor does not resolve onto the overlay", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsor: {
        enabled: false,
        name: "Local LAN",
        assetId: "sponsor-ab12",
        position: "top-right",
        displayMode: "logo-text",
      },
    })
    expect(resolveBroadcastSponsor(config)).toBeUndefined()
  })

  test("enabled with no name or logo stays stored and needs content", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsor: { enabled: true, position: "center", displayMode: "text" },
    })
    expect(config.sponsors).toEqual([
      {
        enabled: true,
        position: "center",
        displayMode: "text",
      },
    ])
    expect(resolveBroadcastSponsor(config)).toBeUndefined()
    expect(sponsorNeedsContent(config.sponsors?.[0])).toBe(true)
  })

  test("stores multiple sponsors and resolves only the enabled ones", () => {
    const config = compactBroadcastConfig({
      format: "BO1",
      teams: { left: {}, right: {} },
      series: { leftMapsWon: 0, rightMapsWon: 0 },
      sponsors: [
        { enabled: true, name: "Local LAN", position: "top-right", displayMode: "text" },
        { enabled: true, name: "SquadVault", position: "center", displayMode: "logo-text" },
        { enabled: false, name: "Hidden", position: "top-right", displayMode: "text" },
      ],
    })
    expect(config.sponsors).toHaveLength(3)
    expect(resolveBroadcastSponsors(config).map((sponsor) => sponsor.name)).toEqual([
      "Local LAN",
      "SquadVault",
    ])
  })

  test.each([
    {
      name: "logo uses the asset",
      mode: "logo" as const,
      input: { name: "LAN", hasLogo: true },
      expected: { showLogo: true, showText: false },
    },
    {
      name: "logo falls back to text",
      mode: "logo" as const,
      input: { name: "LAN", hasLogo: false },
      expected: { showLogo: false, showText: true },
    },
    {
      name: "logo hides when both missing",
      mode: "logo" as const,
      input: { name: "", hasLogo: false },
      expected: undefined,
    },
    {
      name: "text uses name only",
      mode: "text" as const,
      input: { name: "LAN", hasLogo: true },
      expected: { showLogo: false, showText: true },
    },
    {
      name: "text hides without a name",
      mode: "text" as const,
      input: { name: "  ", hasLogo: true },
      expected: undefined,
    },
    {
      name: "logo-text shows both",
      mode: "logo-text" as const,
      input: { name: "LAN", hasLogo: true },
      expected: { showLogo: true, showText: true },
    },
    {
      name: "logo-text degrades to logo",
      mode: "logo-text" as const,
      input: { name: "", hasLogo: true },
      expected: { showLogo: true, showText: false },
    },
    {
      name: "logo-text degrades to text",
      mode: "logo-text" as const,
      input: { name: "LAN", hasLogo: false },
      expected: { showLogo: false, showText: true },
    },
    {
      name: "logo-text hides when both missing",
      mode: "logo-text" as const,
      input: { hasLogo: false },
      expected: undefined,
    },
  ])("$name", ({ mode, input, expected }) => {
    expect(resolveSponsorContent(mode, input)).toEqual(expected)
  })
})
