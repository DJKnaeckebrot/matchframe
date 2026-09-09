import { dirname } from "node:path"
import { appendFileSync, mkdirSync } from "node:fs"

export type RuntimeLog = {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

const SECRET = /auth|secret|password|token/i

export function createRuntimeLog(logFile: string): RuntimeLog {
  mkdirSync(dirname(logFile), { recursive: true })

  function write(level: string, message: string): void {
    if (SECRET.test(message)) {
      return
    }
    const line = `${new Date().toISOString()} ${level} ${message}\n`
    try {
      appendFileSync(logFile, line)
    } catch {
      // Logging must never take down the runtime.
    }
    if (level === "error") {
      console.error(message)
      return
    }
    if (level === "warn") {
      console.warn(message)
      return
    }
    console.log(message)
  }

  return {
    info: (message) => write("info", message),
    warn: (message) => write("warn", message),
    error: (message) => write("error", message),
  }
}
