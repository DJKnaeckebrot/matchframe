import { localAssetIdSchema } from "@workspace/presentation"

import { broadcastOrigin } from "../../lib/server-origin"

/**
 * Local portrait files are served by the broadcast server from data/portraits.
 * Overlay never fetches csgodatabase / Steam / third-party CDNs at runtime.
 */
function apiBase(): string {
  return broadcastOrigin()
}

export function getPortraitAsset(id: string): string | undefined {
  if (!localAssetIdSchema.safeParse(id).success) {
    return undefined
  }
  return `${apiBase()}/api/portraits/${id}`
}
