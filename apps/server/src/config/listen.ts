export const DEFAULT_PORT = 3131
export const GSI_ROUTE = "/api/gsi"

export function listenPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PORT
  if (!raw) {
    return DEFAULT_PORT
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT
}

export function gsiEndpointUri(port = listenPort()): string {
  return `http://127.0.0.1:${port}${GSI_ROUTE}`
}
