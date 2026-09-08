import { isOperatorId, NEUTRAL_PORTRAIT_ID } from "@workspace/presentation"

function apiBase(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")
}

export function getPortraitAsset(id: string): string | undefined {
  if (id !== NEUTRAL_PORTRAIT_ID && !isOperatorId(id)) {
    return undefined
  }
  return `${apiBase()}/api/portraits/${id}`
}
