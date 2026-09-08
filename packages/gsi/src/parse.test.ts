import { describe, expect, test } from "bun:test"

import { parseGsiPayload } from "./parse"

const fixturePath = new URL("../fixtures/inferno-live.json", import.meta.url)

describe("parseGsiPayload", () => {
  test("parses a valid GSI payload", async () => {
    const payload: unknown = await Bun.file(fixturePath).json()
    const result = parseGsiPayload(payload)

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data.map?.name).toBe("de_inferno")
    expect(result.data.allplayers).toBeDefined()
  })

  test("accepts unknown additional Valve fields", () => {
    const result = parseGsiPayload({
      provider: { timestamp: 1, steamid: "1", future_provider_flag: true },
      map: {
        name: "de_inferno",
        phase: "live",
        new_map_property: "ignore-me",
      },
      round: { phase: "live", extra_round_flag: 1 },
      player: { steamid: "1", name: "Nova", mystery: true },
      allplayers: {
        "1": { name: "Nova", team: "CT", extra_player_flag: true },
      },
      bomb: { state: "carried", extra_bomb_flag: false },
      valve_future_field: { nested: true, count: 3 },
    })

    expect(result.success).toBe(true)
  })

  test("rejects invalid top-level input", () => {
    for (const input of [null, [], "", 42]) {
      const result = parseGsiPayload(input)
      expect(result.success).toBe(false)
      if (result.success) {
        throw new Error("expected parse to fail")
      }
      expect(result.error).toBe("Invalid GSI payload")
      expect(result.details.length).toBeGreaterThan(0)
    }
  })
})
