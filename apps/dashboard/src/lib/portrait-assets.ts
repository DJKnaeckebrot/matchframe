import { localAssetIdSchema } from "@workspace/presentation"

function apiBase(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")
}

export function getPortraitAsset(id: string): string | undefined {
  if (!localAssetIdSchema.safeParse(id).success) {
    return undefined
  }
  return `${apiBase()}/api/portraits/${id}`
}
