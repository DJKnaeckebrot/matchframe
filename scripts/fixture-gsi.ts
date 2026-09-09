import { GSI_FIXTURE_VARIANTS, loadGsiFixture } from "../packages/gsi/src/fixtures.ts"
import type { GsiFixtureVariant } from "../packages/gsi/src/fixtures.ts"

const DEFAULT_URL = "http://localhost:3131/api/gsi"

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

type DemoName = keyof typeof FIXTURE_DEMOS

const url = process.env.MATCHFRAME_GSI_URL ?? DEFAULT_URL
const requested = process.argv[2] ?? "live"

if (isDemoName(requested)) {
  await runDemo(requested)
} else {
  await postFixture(variantFromArg(requested))
}

function isDemoName(value: string): value is DemoName {
  return value in FIXTURE_DEMOS
}

function variantFromArg(value: string): GsiFixtureVariant {
  if ((GSI_FIXTURE_VARIANTS as readonly string[]).includes(value)) {
    return value as GsiFixtureVariant
  }
  const demos = Object.keys(FIXTURE_DEMOS).join(", ")
  throw new Error(
    `Unknown fixture variant "${value}". Use: ${GSI_FIXTURE_VARIANTS.join(", ")} (or ${demos})`
  )
}

async function runDemo(name: DemoName): Promise<void> {
  for (const step of FIXTURE_DEMOS[name]) {
    await postFixture(step.variant)
    if (step.holdMs > 0) {
      await Bun.sleep(step.holdMs)
    }
  }
}

async function postFixture(variant: GsiFixtureVariant): Promise<void> {
  const payload = await loadGsiFixture(variant)
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Fixture POST failed (${response.status}): ${body}`)
  }

  console.log(`Posted "${variant}" fixture to ${url}`)
}
