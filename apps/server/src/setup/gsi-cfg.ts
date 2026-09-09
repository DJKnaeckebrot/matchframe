import { GSI_HEARTBEAT_MS } from "@workspace/game-state"

import { gsiEndpointUri } from "../config/listen"
import { GSI_CFG_FILENAME } from "./types"
import canonicalTemplate from "../../gsi/gamestate_integration_matchframe.cfg" with { type: "text" }

export { GSI_CFG_FILENAME }

export async function loadGsiCfgTemplate(): Promise<string> {
  return canonicalTemplate
}

export function renderGsiCfg(template: string, uri = gsiEndpointUri()): string {
  if (/"uri"\s+"[^"]+"/.test(template)) {
    return template.replace(/("uri"\s+)"[^"]+"/, `$1"${uri}"`)
  }
  throw new Error("Matchframe GSI template is missing a uri field")
}

export function heartbeatMsFromCfg(cfg: string): number | null {
  const match = cfg.match(/"heartbeat"\s+"([0-9.]+)"/)
  if (!match?.[1]) {
    return null
  }
  const seconds = Number.parseFloat(match[1])
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null
  }
  return Math.round(seconds * 1000)
}

export function gsiCfgMatches(installed: string, canonical: string): boolean {
  return collapseWhitespace(installed) === collapseWhitespace(canonical)
}

export function assertHeartbeatMatchesPolicy(template: string): void {
  const heartbeat = heartbeatMsFromCfg(template)
  if (heartbeat !== GSI_HEARTBEAT_MS) {
    throw new Error(
      `GSI cfg heartbeat ${String(heartbeat)}ms does not match GSI_HEARTBEAT_MS ${String(GSI_HEARTBEAT_MS)}`
    )
  }
}

function collapseWhitespace(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim()
}
