/**
 * Development-only grenade pipeline dump. Gated by MATCHFRAME_DEBUG_GRENADES=1.
 * Logs compact grenade shapes from incoming HTTP, merged raw, and GameState.
 */

export type GrenadeDebugEntry = {
  id: string
  type?: unknown
  owner?: unknown
  position?: unknown
  velocity?: unknown
  lifetime?: unknown
  effecttime?: unknown
  flames: GrenadeFlamesDebug
}

export type GrenadeFlamesDebug = {
  present: boolean
  jsType: string
  keys?: readonly string[]
  valueKinds?: readonly string[]
  sample?: unknown
}

export type GrenadePipelineDebug = {
  incomingKeys: readonly string[]
  incomingGrenadeBlock: "grenades" | "allgrenades" | "both" | "none"
  incoming: readonly GrenadeDebugEntry[]
  incomingAllgrenades: readonly GrenadeDebugEntry[]
  merged: readonly GrenadeDebugEntry[]
  mergedAllgrenades: readonly GrenadeDebugEntry[]
  normalized: readonly {
    id: string
    type: string
    hasPosition: boolean
    flameCount: number
  }[]
  incomingGrenadesRaw?: unknown
  incomingAllgrenadesRaw?: unknown
  mergedGrenadesRaw?: unknown
  mergedAllgrenadesRaw?: unknown
}

export function summarizeGrenadeMap(raw: unknown): GrenadeDebugEntry[] {
  if (!isRecord(raw)) {
    return []
  }
  const entries: GrenadeDebugEntry[] = []
  for (const [id, value] of Object.entries(raw)) {
    entries.push(summarizeGrenade(id, value))
  }
  return entries
}

export function incomingGrenadeBlock(
  incoming: Record<string, unknown>
): GrenadePipelineDebug["incomingGrenadeBlock"] {
  const grenades = "grenades" in incoming
  const allgrenades = "allgrenades" in incoming
  if (grenades && allgrenades) {
    return "both"
  }
  if (grenades) {
    return "grenades"
  }
  if (allgrenades) {
    return "allgrenades"
  }
  return "none"
}

export function buildGrenadePipelineDebug(
  incoming: Record<string, unknown>,
  merged: unknown,
  normalized: readonly { id: string; type: string; position?: unknown; flames?: readonly unknown[] }[]
): GrenadePipelineDebug {
  const incomingRecord = incoming
  const mergedRecord = isRecord(merged) ? merged : {}
  return {
    incomingKeys: Object.keys(incomingRecord),
    incomingGrenadeBlock: incomingGrenadeBlock(incomingRecord),
    incoming: summarizeGrenadeMap(incomingRecord.grenades),
    incomingAllgrenades: summarizeGrenadeMap(incomingRecord.allgrenades),
    merged: summarizeGrenadeMap(mergedRecord.grenades),
    mergedAllgrenades: summarizeGrenadeMap(mergedRecord.allgrenades),
    normalized: normalized.map((grenade) => ({
      id: grenade.id,
      type: grenade.type,
      hasPosition: grenade.position !== undefined && grenade.position !== null,
      flameCount: grenade.flames?.length ?? 0,
    })),
    incomingGrenadesRaw: incomingRecord.grenades,
    incomingAllgrenadesRaw: incomingRecord.allgrenades,
    mergedGrenadesRaw: mergedRecord.grenades,
    mergedAllgrenadesRaw: mergedRecord.allgrenades,
  }
}

export function debugHasFireGrenade(debug: GrenadePipelineDebug): boolean {
  return [...debug.incoming, ...debug.incomingAllgrenades, ...debug.merged, ...debug.mergedAllgrenades].some(
    isFireDebugEntry
  )
}

function isFireDebugEntry(entry: GrenadeDebugEntry): boolean {
  const type = String(entry.type ?? "").toLowerCase()
  return (
    type === "firebomb" ||
    type === "inferno" ||
    type === "molotov" ||
    type === "incgrenade" ||
    type === "incendiary" ||
    entry.flames.present
  )
}

function summarizeGrenade(id: string, raw: unknown): GrenadeDebugEntry {
  if (!isRecord(raw)) {
    return {
      id,
      type: typeof raw,
      flames: { present: false, jsType: typeof raw },
    }
  }
  return {
    id,
    type: raw.type,
    owner: raw.owner,
    position: raw.position,
    velocity: raw.velocity,
    lifetime: raw.lifetime,
    effecttime: raw.effecttime,
    flames: summarizeFlames(raw.flames),
  }
}

function summarizeFlames(raw: unknown): GrenadeFlamesDebug {
  if (raw === undefined) {
    return { present: false, jsType: "undefined" }
  }
  if (raw === null) {
    return { present: true, jsType: "null" }
  }
  if (Array.isArray(raw)) {
    return {
      present: true,
      jsType: "array",
      valueKinds: raw.slice(0, 8).map(valueKind),
      sample: raw[0],
    }
  }
  if (typeof raw === "object") {
    const keys = Object.keys(raw)
    const values = Object.values(raw)
    return {
      present: true,
      jsType: "object",
      keys: keys.slice(0, 12),
      valueKinds: values.slice(0, 8).map(valueKind),
      sample: values[0],
    }
  }
  return { present: true, jsType: typeof raw, sample: raw }
}

function valueKind(value: unknown): string {
  if (value === null) {
    return "null"
  }
  if (Array.isArray(value)) {
    return `array(${value.length})`
  }
  return typeof value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false
}
