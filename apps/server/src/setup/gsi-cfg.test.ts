import { describe, expect, test } from "bun:test"
import { GSI_HEARTBEAT_MS } from "@workspace/game-state"

import { gsiEndpointUri } from "../config/listen"
import {
  assertHeartbeatMatchesPolicy,
  gsiCfgMatches,
  heartbeatMsFromCfg,
  loadGsiCfgTemplate,
  renderGsiCfg,
} from "./gsi-cfg"

describe("Matchframe GSI template", () => {
  test("heartbeat matches the centralized freshness policy", async () => {
    const template = await loadGsiCfgTemplate()
    expect(heartbeatMsFromCfg(template)).toBe(GSI_HEARTBEAT_MS)
    expect(() => assertHeartbeatMatchesPolicy(template)).not.toThrow()
  })

  test("renders the configured GSI URI without duplicating it", async () => {
    const template = await loadGsiCfgTemplate()
    const rendered = renderGsiCfg(template, gsiEndpointUri(3131))
    expect(rendered).toContain(`"uri"               "${gsiEndpointUri(3131)}"`)
    expect(rendered).toContain("map_round_wins")
    expect(rendered).toContain("player_position")
    expect(rendered).toContain("allgrenades")
    expect(rendered).toContain("grenades")
    expect(rendered).toContain("gamestate_integration_matchframe.cfg")
  })

  test("whitespace-only differences are the same config", () => {
    const a = `"Matchframe GSI"\n{\n\t"uri" "http://127.0.0.1:3131/api/gsi"\n}\n`
    const b = `"Matchframe GSI"\r\n{\n  "uri"    "http://127.0.0.1:3131/api/gsi"\n}\n`
    expect(gsiCfgMatches(a, b)).toBe(true)
    expect(gsiCfgMatches(a, a.replace("3131", "3132"))).toBe(false)
  })
})
