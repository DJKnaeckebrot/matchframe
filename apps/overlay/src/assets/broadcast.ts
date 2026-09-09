import { localAssetIdSchema } from "@workspace/presentation"

function apiBase(): string {
  return (import.meta.env.VITE_API_URL || "http://localhost:3131").replace(/\/$/, "")
}

export function getBroadcastAsset(id: string): string | undefined {
  if (!localAssetIdSchema.safeParse(id).success) {
    return undefined
  }
  return `${apiBase()}/api/assets/${id}`
}
