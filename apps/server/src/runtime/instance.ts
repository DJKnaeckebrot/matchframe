export function isAddrInUse(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  const code = "code" in error ? String(error.code) : ""
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "EADDRINUSE" ||
    message.includes("EADDRINUSE") ||
    /address already in use/i.test(message) ||
    /is port \d+ in use/i.test(message)
  )
}

export async function findRunningMatchframe(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(800),
    })
    if (!response.ok) {
      return false
    }
    const body: unknown = await response.json()
    return isRecord(body) && body.status === "ok"
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
