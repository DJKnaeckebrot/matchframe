import { describe, expect, test } from "bun:test"

import { buildGrenadePipelineDebug, debugHasFireGrenade, summarizeGrenadeMap } from "./grenade-debug"

describe("grenade debug summaries", () => {
  test("reports flame key and value kinds without requiring flame_N names", () => {
    const entries = summarizeGrenadeMap({
      "12": {
        type: "inferno",
        owner: "76561198000000001",
        lifetime: "1.2",
        flames: { "0": "1, 2, 3", "1": "4, 5, 6" },
      },
    })
    expect(entries).toEqual([
      {
        id: "12",
        type: "inferno",
        owner: "76561198000000001",
        position: undefined,
        velocity: undefined,
        lifetime: "1.2",
        effecttime: undefined,
        flames: {
          present: true,
          jsType: "object",
          keys: ["0", "1"],
          valueKinds: ["string", "string"],
          sample: "1, 2, 3",
        },
      },
    ])
  })

  test("flags incoming allgrenades vs grenades", () => {
    const debug = buildGrenadePipelineDebug(
      { allgrenades: { "1": { type: "firebomb", position: "1, 2, 3" } } },
      { grenades: {} },
      []
    )
    expect(debug.incomingGrenadeBlock).toBe("allgrenades")
    expect(debug.incomingAllgrenades[0]?.type).toBe("firebomb")
    expect(debug.incoming).toEqual([])
    expect(debug.mergedAllgrenades).toEqual([])
    expect(debugHasFireGrenade(debug)).toBe(true)
  })
})
