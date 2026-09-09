import { GSI_FIXTURE_VARIANTS, loadGsiFixture } from "../packages/gsi/src/fixtures.ts"
import type { GsiFixtureVariant } from "../packages/gsi/src/fixtures.ts"

const DEFAULT_URL = "http://localhost:3131/api/gsi"

const NOVA = "76561198000000001"
const CT_IDS = [
  "76561198000000001",
  "76561198000000002",
  "76561198000000003",
  "76561198000000007",
  "76561198000000008",
] as const
const T_IDS = [
  "76561198000000004",
  "76561198000000005",
  "76561198000000006",
  "76561198000000009",
  "76561198000000010",
] as const

const FIXTURE_DEMOS = {
  "demo:defuse": [
    { variant: "bomb-planted", holdMs: 1000 },
    { variant: "bomb-defusing", holdMs: 5200 },
    { variant: "bomb-defused", holdMs: 0 },
  ],
  "demo:smoke": [
    { variant: "radar-anubis", holdMs: 800 },
    { variant: "radar-anubis-smoke-flight", holdMs: 700 },
    { variant: "radar-anubis-smoke-flight-moved", holdMs: 700 },
    { variant: "radar-anubis-smoke-active", holdMs: 2800 },
    { variant: "radar-anubis-smoke-removed", holdMs: 0 },
  ],
  "demo:grenades": [
    { variant: "radar-anubis", holdMs: 800 },
    { variant: "radar-flash-flight", holdMs: 900 },
    { variant: "radar-he-flight", holdMs: 900 },
    { variant: "radar-fire-flight", holdMs: 900 },
    { variant: "radar-inferno-active", holdMs: 1600 },
    { variant: "radar-grenades-mixed", holdMs: 2200 },
    { variant: "radar-grenades-cleared", holdMs: 0 },
  ],
} as const satisfies Record<
  string,
  readonly { variant: GsiFixtureVariant; holdMs: number }[]
>

type VariantDemoName = keyof typeof FIXTURE_DEMOS
type ScriptedDemoName = "demo:round-win" | "demo:ace" | "demo:clutch" | "demo:mvp"
type ScriptedDemoName = "demo:round-win" | "demo:ace" | "demo:clutch" | "demo:mvp"

const url = process.env.MATCHFRAME_GSI_URL ?? DEFAULT_URL
const requested = process.argv[2] ?? "live"

if (isScriptedDemo(requested)) {
  await runScriptedDemo(requested)
} else if (isVariantDemo(requested)) {
  await runVariantDemo(requested)
} else {
  await postFixture(variantFromArg(requested))
}

function isVariantDemo(value: string): value is VariantDemoName {
  return value in FIXTURE_DEMOS
}

function isScriptedDemo(value: string): value is ScriptedDemoName {
  return (
    value === "demo:round-win" ||
    value === "demo:ace" ||
    value === "demo:clutch" ||
    value === "demo:mvp"
  )
}

function variantFromArg(value: string): GsiFixtureVariant {
  if ((GSI_FIXTURE_VARIANTS as readonly string[]).includes(value)) {
    return value as GsiFixtureVariant
  }
  const demos = [...Object.keys(FIXTURE_DEMOS), "demo:round-win", "demo:ace", "demo:clutch", "demo:mvp"].join(
    ", "
  )
  throw new Error(
    `Unknown fixture variant "${value}". Use: ${GSI_FIXTURE_VARIANTS.join(", ")} (or ${demos})`
  )
}

async function runVariantDemo(name: VariantDemoName): Promise<void> {
  for (const step of FIXTURE_DEMOS[name]) {
    await postFixture(step.variant)
    if (step.holdMs > 0) {
      await Bun.sleep(step.holdMs)
    }
  }
}

async function runScriptedDemo(name: ScriptedDemoName): Promise<void> {
  if (name === "demo:round-win") {
    await postFixture("freeze")
    await Bun.sleep(400)
    await postFixture("live")
    await Bun.sleep(700)
    await postFixture("round-ct-win")
    return
  }

  const payload = (await loadGsiFixture("freeze")) as GsiDemo
  await postRaw(payload, "freeze")
  await Bun.sleep(400)
  setLive(payload)
  await postRaw(payload, "live")
  await Bun.sleep(500)

  if (name === "demo:ace") {
    for (const victim of T_IDS) {
      killBy(payload, NOVA, victim)
      await postRaw(payload, `ace-kill:${victim.slice(-2)}`)
      await Bun.sleep(280)
    }
    setOver(payload, "CT", "ct_win_elimination")
    await postRaw(payload, "ace-over")
    return
  }

  if (name === "demo:clutch") {
    for (const steamId of CT_IDS.slice(1)) {
      setDead(payload, steamId)
    }
    setDead(payload, T_IDS[3] ?? "")
    setDead(payload, T_IDS[4] ?? "")
    await postRaw(payload, "clutch-1v3")
    await Bun.sleep(900)
    for (const steamId of T_IDS) {
      setDead(payload, steamId)
    }
    setOver(payload, "CT", "ct_win_elimination")
    await postRaw(payload, "clutch-over")
    return
  }

  killBy(payload, NOVA, T_IDS[0] ?? "")
  await postRaw(payload, "mvp-k1")
  await Bun.sleep(250)
  killBy(payload, NOVA, T_IDS[1] ?? "")
  await postRaw(payload, "mvp-k2")
  await Bun.sleep(250)
  setOver(payload, "CT", "ct_win_defuse", "defused")
  await postRaw(payload, "mvp-over")
}

type GsiDemo = {
  map?: {
    round?: number
    round_wins?: Record<string, string>
  }
  round?: {
    phase?: string
    win_team?: string
    bomb?: string
  }
  phase_countdowns?: {
    phase?: string
    phase_ends_in?: number | string
  }
  allplayers?: Record<
    string,
    {
      team?: string
      state?: { health?: number; armor?: number; helmet?: boolean }
      match_stats?: { kills?: number; assists?: number; deaths?: number }
    }
  >
  bomb?: { state?: string }
}

function setLive(payload: GsiDemo): void {
  payload.round = { phase: "live" }
  payload.phase_countdowns = { phase: "live", phase_ends_in: "83.4" }
  delete payload.round.win_team
  delete payload.round.bomb
}

function setOver(
  payload: GsiDemo,
  winTeam: "CT" | "T",
  win: string,
  bomb?: "defused" | "exploded"
): void {
  payload.round = { phase: "over", win_team: winTeam }
  if (bomb) {
    payload.round.bomb = bomb
    payload.bomb = { state: bomb }
  }
  payload.phase_countdowns = { phase: "over", phase_ends_in: "6.0" }
  const round = payload.map?.round ?? 0
  payload.map = {
    ...payload.map,
    round_wins: { ...(payload.map?.round_wins ?? {}), [String(round + 1)]: win },
  }
}

function killBy(payload: GsiDemo, killerId: string, victimId: string): void {
  setDead(payload, victimId)
  const killer = payload.allplayers?.[killerId]
  if (!killer?.match_stats) {
    return
  }
  killer.match_stats.kills = (killer.match_stats.kills ?? 0) + 1
}

function setDead(payload: GsiDemo, steamId: string): void {
  const player = payload.allplayers?.[steamId]
  if (!player) {
    return
  }
  player.state = { ...player.state, health: 0, armor: 0, helmet: false }
  if (player.match_stats) {
    player.match_stats.deaths = (player.match_stats.deaths ?? 0) + 1
  }
}

async function postFixture(variant: GsiFixtureVariant): Promise<void> {
  await postRaw(await loadGsiFixture(variant), variant)
}

async function postRaw(payload: unknown, label: string): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Fixture POST failed (${response.status}): ${body}`)
  }

  console.log(`Posted "${label}" fixture to ${url}`)
}
