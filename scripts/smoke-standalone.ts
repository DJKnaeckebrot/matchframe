import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dir, "..")
const fixturePath = join(repoRoot, "packages", "gsi", "fixtures", "inferno-live.json")

type Args = {
  exe: string
  portable: boolean
  port: number
}

function parseArgs(argv: readonly string[]): Args {
  const flags = new Set(argv.slice(2))
  const exeIndex = argv.indexOf("--exe")
  const exe = exeIndex >= 0 ? argv[exeIndex + 1] : join(repoRoot, "dist", "runtime", "Matchframe.exe")
  const portIndex = argv.indexOf("--port")
  const port = portIndex >= 0 ? Number.parseInt(argv[portIndex + 1] ?? "", 10) : 33131
  return {
    exe: resolve(exe ?? ""),
    portable: flags.has("--portable"),
    port: Number.isFinite(port) ? port : 33131,
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  if (!existsSync(args.exe)) {
    fail(`Missing executable: ${args.exe}`)
  }
  if (!existsSync(fixturePath)) {
    fail(`Missing GSI fixture: ${fixturePath}`)
  }

  const work = await mkdtemp(join(tmpdir(), "matchframe-smoke-"))
  const appDir = join(work, "Matchframe")
  await mkdir(appDir, { recursive: true })
  await Bun.write(join(appDir, "Matchframe.exe"), await Bun.file(args.exe).arrayBuffer())
  if (args.portable) {
    await Bun.write(join(appDir, "portable.flag"), "")
  }

  const dataDir = args.portable ? join(appDir, "data") : join(work, "external-data")
  const origin = `http://127.0.0.1:${args.port}`
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(args.port),
  }
  if (args.portable) {
    delete env.MATCHFRAME_DATA_DIR
  } else {
    env.MATCHFRAME_DATA_DIR = dataDir
  }

  let passed = false
  const launched = launch(join(appDir, "Matchframe.exe"), appDir, env)
  try {
    await waitForHealth(origin, launched.proc)
    await expectStatus(`${origin}/`, 200)
    await expectStatus(`${origin}/overlay`, 302)
    await expectStatus(`${origin}/overlay/`, 200)
    await expectStatus(`${origin}/health`, 200)
    await expectStatus(`${origin}/api/status`, 200)

    const fixture = await Bun.file(fixturePath).text()
    const gsi = await fetch(`${origin}/api/gsi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: fixture,
    })
    if (gsi.status !== 204) {
      fail(`GSI fixture was not accepted (${String(gsi.status)})`)
    }

    await expectWebsocket(origin)

    const saved = await fetch(`${origin}/api/config/broadcast`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "BO3" }),
    })
    if (!saved.ok) {
      fail(`Could not persist broadcast config (${String(saved.status)})`)
    }

    launched.proc.kill()
    await launched.proc.exited

    const restarted = launch(join(appDir, "Matchframe.exe"), appDir, env)
    try {
      await waitForHealth(origin, restarted.proc)
      const overlay = await fetch(`${origin}/api/config/broadcast`)
      const body = (await overlay.json()) as { format?: string }
      if (body.format !== "BO3") {
        fail("Broadcast config did not persist across restart")
      }
      if (!existsSync(join(dataDir, "overlay.json"))) {
        fail(`Expected writable data file at ${join(dataDir, "overlay.json")}`)
      }
      console.log(`Smoke OK (${args.portable ? "portable" : "standalone"}) ${origin}`)
      console.log(`CWD: ${appDir}`)
      console.log(`Data directory: ${dataDir}`)
      passed = true
    } finally {
      restarted.proc.kill()
      await restarted.proc.exited
    }
  } catch (error) {
    launched.proc.kill()
    await launched.proc.exited.catch(() => undefined)
    dumpLogs(dataDir)
    throw error
  } finally {
    if (passed) {
      await rm(work, { recursive: true, force: true }).catch(() => undefined)
    } else {
      console.error(`Kept smoke directory: ${work}`)
    }
  }
}

function launch(exe: string, cwd: string, env: NodeJS.ProcessEnv): { proc: ReturnType<typeof Bun.spawn> } {
  const proc = Bun.spawn([exe, "--no-browser"], {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  })
  return { proc }
}

async function drain(proc: ReturnType<typeof Bun.spawn>): Promise<string> {
  const stdout = proc.stdout ? await new Response(proc.stdout).text() : ""
  const stderr = proc.stderr ? await new Response(proc.stderr).text() : ""
  return `${stdout}${stderr}`.trim()
}

async function waitForHealth(origin: string, proc: ReturnType<typeof Bun.spawn>): Promise<void> {
  const deadline = Date.now() + 20_000
  let last = "no response"
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      const output = await drain(proc)
      fail(`Matchframe exited before becoming healthy (${String(proc.exitCode)})${output ? `\n${output}` : ""}`)
    }
    try {
      const response = await fetch(`${origin}/health`)
      if (response.ok) {
        return
      }
      last = `HTTP ${String(response.status)}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await Bun.sleep(200)
  }
  fail(`Matchframe did not become healthy at ${origin}: ${last}`)
}

async function expectStatus(url: string, status: number): Promise<void> {
  const response = await fetch(url, { redirect: "manual" })
  if (response.status !== status) {
    fail(`${url} expected ${String(status)}, got ${String(response.status)}`)
  }
}

async function expectWebsocket(origin: string): Promise<void> {
  const url = `${origin.replace("http", "ws")}/ws`
  const ws = new WebSocket(url)
  const messages: string[] = []
  await new Promise<void>((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket snapshot timed out")), 5000)
    ws.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : ""
      messages.push(raw)
      if (isHandshake(raw)) {
        clearTimeout(timer)
        resolvePromise()
      }
    })
    ws.addEventListener("error", () => {
      clearTimeout(timer)
      reject(new Error("WebSocket failed"))
    })
  })
  ws.close()
  if (messages.length === 0) {
    fail("WebSocket connected but received no snapshot/config")
  }
}

function isHandshake(raw: string): boolean {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null || !("type" in value)) {
      return false
    }
    const type = (value as { type: unknown }).type
    return type === "connection" || type === "theme" || type === "broadcast-config" || type === "presentation"
  } catch {
    return false
  }
}

function dumpLogs(dataDir: string): void {
  const candidates = [
    join(dataDir, "logs", "matchframe.log"),
    join(dataDir, "..", "logs", "matchframe.log"),
  ]
  for (const file of candidates) {
    if (!existsSync(file)) {
      continue
    }
    console.error(`--- ${file} ---`)
    console.error(readFileSync(file, "utf8"))
  }
}

function fail(message: string): never {
  throw new Error(message)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
