import { copyFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

const dataDir = process.env.MATCHFRAME_DATA_DIR ?? join(process.cwd(), "apps/server/data")
const latest = join(dataDir, "gsi-capture", "latest.json")
const name = process.argv[2]

if (!name) {
  console.log(`GSI capture is off unless MATCHFRAME_GSI_CAPTURE=1 when starting the server.

That overwrites ${latest} with a sanitized merged payload (no auth token, no provider steamid).

Copy the last capture into packages/gsi/fixtures:

  bun run scripts/capture-gsi.ts anubis-live.json
`)
  process.exit(0)
}

const dest = join(process.cwd(), "packages/gsi/fixtures", name)
await mkdir(join(process.cwd(), "packages/gsi/fixtures"), { recursive: true })
await copyFile(latest, dest)
console.log(`Copied ${latest} → ${dest}`)
