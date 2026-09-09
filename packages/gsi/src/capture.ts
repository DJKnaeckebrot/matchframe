const CAPTURE_KEEP = new Set([
  "provider",
  "map",
  "round",
  "player",
  "allplayers",
  "bomb",
  "grenades",
  "allgrenades",
  "phase_countdowns",
])

/**
 * Strip auth/secrets and local-user identifiers from a merged GSI object
 * so it can be written as a development fixture.
 */
export function sanitizeGsiCapture(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const source = input as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of CAPTURE_KEEP) {
    if (key in source) {
      out[key] = source[key]
    }
  }

  if (isRecord(out.provider)) {
    const provider = { ...out.provider }
    delete provider.steamid
    out.provider = provider
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
