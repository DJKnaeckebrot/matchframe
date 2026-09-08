import { GSI_FIXTURE_VARIANTS, loadGsiFixture } from "../packages/gsi/src/fixtures.ts"
import type { GsiFixtureVariant } from "../packages/gsi/src/fixtures.ts"

const DEFAULT_URL = "http://localhost:3131/api/gsi"

function variantFromArgs(argv: readonly string[]): GsiFixtureVariant {
  const value = argv[2] ?? "live"
  if ((GSI_FIXTURE_VARIANTS as readonly string[]).includes(value)) {
    return value as GsiFixtureVariant
  }
  throw new Error(`Unknown fixture variant "${value}". Use: ${GSI_FIXTURE_VARIANTS.join(", ")}`)
}

const variant = variantFromArgs(process.argv)
const url = process.env.MATCHFRAME_GSI_URL ?? DEFAULT_URL
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
