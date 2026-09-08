import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { OPERATOR_PORTRAITS } from "../packages/presentation/src/operators.ts"

/**
 * One-time local copy of CS2 agent inventory art.
 * Overlay never talks to this host — files land in the server data dir.
 *
 * Source is extracted Valve panorama character art (same renders community
 * databases show). Counter-Strike assets remain property of Valve.
 */
const SOURCE = "https://cs2cdn.com/econ/characters"

function portraitDir(): string {
  if (process.env.MATCHFRAME_DATA_DIR) {
    return join(process.env.MATCHFRAME_DATA_DIR, "portraits")
  }
  return join(import.meta.dir, "../apps/server/data/portraits")
}

async function download(id: string, dir: string): Promise<string> {
  const url = `${SOURCE}/customplayer_${id}.png`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${id}: ${response.status} ${url}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength < 1024) {
    throw new Error(`${id}: response too small (${bytes.byteLength} bytes)`)
  }
  await Bun.write(join(dir, `${id}.png`), bytes)
  return `${id}.png ${bytes.byteLength}`
}

const dir = portraitDir()
await mkdir(dir, { recursive: true })

let failed = 0
for (const operator of OPERATOR_PORTRAITS) {
  try {
    const result = await download(operator.id, dir)
    console.log(result)
  } catch (error) {
    failed += 1
    console.error(error instanceof Error ? error.message : error)
  }
}

if (failed > 0) {
  console.error(`imported with ${failed} missing files`)
  process.exit(1)
}

console.log(`imported ${OPERATOR_PORTRAITS.length} operator portraits into ${dir}`)
