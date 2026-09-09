import { localAssetIdSchema } from "@workspace/presentation"

import { broadcastOrigin } from "../lib/server-origin"

function apiBase(): string {
  return broadcastOrigin()
}

export function getBroadcastAsset(id: string): string | undefined {
  if (!localAssetIdSchema.safeParse(id).success) {
    return undefined
  }
  return `${apiBase()}/api/assets/${id}`
}
