import { join } from "node:path"
import { localAssetIdSchema } from "@workspace/presentation"

export function isSafePortraitId(id: string): boolean {
  return localAssetIdSchema.safeParse(id).success
}

export async function readPortraitFile(
  dir: string,
  id: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!isSafePortraitId(id)) {
    return null
  }
  const png = join(dir, `${id}.png`)
  const file = Bun.file(png)
  if (!(await file.exists())) {
    return null
  }
  return { body: await file.arrayBuffer(), contentType: "image/png" }
}
