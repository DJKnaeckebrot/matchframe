import { join } from "node:path"
import { isOperatorId, NEUTRAL_PORTRAIT_ID } from "@workspace/presentation"

const PORTRAIT_ID = /^[A-Za-z0-9_]+$/

export function isSafePortraitId(id: string): boolean {
  return PORTRAIT_ID.test(id) && (id === NEUTRAL_PORTRAIT_ID || isOperatorId(id))
}

export async function readPortraitFile(
  dir: string,
  id: string
): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (!isSafePortraitId(id)) {
    return null
  }
  const png = join(dir, `${id}.png`)
  const file = Bun.file(png)
  if (!(await file.exists())) {
    return null
  }
  return { body: new Uint8Array(await file.arrayBuffer()), contentType: "image/png" }
}
