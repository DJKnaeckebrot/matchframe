import { localAssetIdSchema } from "@workspace/presentation"

/**
 * Local portrait files are served by the broadcast server from data/portraits.
 * Overlay never fetches csgodatabase / Steam / third-party CDNs at runtime.
 */
function apiBase(): string {
  return (import.meta.env.VITE_API_URL || "http://localhost:3131").replace(/\/$/, "")
}

export function getPortraitAsset(id: string): string | undefined {
  if (!localAssetIdSchema.safeParse(id).success) {
    return undefined
  }
  return `${apiBase()}/api/portraits/${id}`
}
