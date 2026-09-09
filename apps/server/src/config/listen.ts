export const DEFAULT_PORT = 3131
export const DEFAULT_HOST = "127.0.0.1"
export const GSI_ROUTE = "/api/gsi"
export const OVERLAY_PATH = "/overlay"

export function listenPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PORT
  if (!raw) {
    return DEFAULT_PORT
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT
}

export function listenHost(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.MATCHFRAME_HOST ?? env.HOST
  if (!raw || raw.trim() === "") {
    return DEFAULT_HOST
  }
  return raw.trim()
}

export function publicHost(env: NodeJS.ProcessEnv = process.env): string {
  const host = listenHost(env)
  if (host === "0.0.0.0" || host === "::" || host === "[::]") {
    return DEFAULT_HOST
  }
  return host
}

export function dashboardPublicUrl(port = listenPort(), env: NodeJS.ProcessEnv = process.env): string {
  return `http://${publicHost(env)}:${port}/`
}

export function overlayPublicUrl(port = listenPort(), env: NodeJS.ProcessEnv = process.env): string {
  return `http://${publicHost(env)}:${port}${OVERLAY_PATH}`
}

export function websocketPublicUrl(port = listenPort(), env: NodeJS.ProcessEnv = process.env): string {
  return `ws://${publicHost(env)}:${port}/ws`
}

export function gsiEndpointUri(port = listenPort()): string {
  return `http://127.0.0.1:${port}${GSI_ROUTE}`
}
