export type OverlayLocation = {
  protocol: string
  hostname: string
  origin: string
}

export function resolveOverlayPublicUrl(input: {
  explicit?: string
  production: boolean
  overlayPort?: string
  location?: OverlayLocation
}): string {
  const explicit = input.explicit?.replace(/\/$/, "")
  if (explicit) {
    return explicit
  }
  if (input.production) {
    return input.location ? `${input.location.origin}/overlay` : "/overlay"
  }
  const port = input.overlayPort || "5174"
  if (!input.location) {
    return `http://localhost:${port}`
  }
  return `${input.location.protocol}//${input.location.hostname}:${port}`
}
