export function broadcastOrigin(): string {
  const explicit = import.meta.env.VITE_API_URL
  if (explicit) {
    return explicit.replace(/\/$/, "")
  }
  if (import.meta.env.PROD) {
    return typeof window === "undefined" ? "" : window.location.origin
  }
  return "http://localhost:3131"
}

export function realtimeUrl(): string {
  if (import.meta.env.VITE_REALTIME_URL) {
    return import.meta.env.VITE_REALTIME_URL
  }
  if (import.meta.env.PROD) {
    if (typeof window === "undefined") {
      return "ws://127.0.0.1:3131/ws"
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}/ws`
  }
  return "ws://localhost:3131/ws"
}
