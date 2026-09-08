/**
 * Capture README screenshots. Needs Chrome, a running stack, and Vite on
 * 127.0.0.1 (`bun run dev -- --host 127.0.0.1` in overlay/dashboard).
 * Post a HUD fixture first: `bun run fixture:gsi radar-anubis-bomb-planted`.
 */
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

const chrome = join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe")
const outDir = join(import.meta.dir, "../docs/screenshots")
const profile = join(process.env.TEMP ?? "/tmp", "mf-readme-shots")

await mkdir(outDir, { recursive: true })

const shots = [
  ["http://127.0.0.1:5174/?preview=1", "overlay.png", 1920, 1080],
  ["http://127.0.0.1:5173/", "dashboard-overlay.png", 1440, 900],
  ["http://127.0.0.1:5173/?page=players", "dashboard-players.png", 1440, 900],
  ["http://127.0.0.1:5173/?page=appearance", "dashboard-appearance.png", 1440, 900],
] as const

for (const [url, file, width, height] of shots) {
  const dest = join(outDir, file)
  console.log("capture", url, "->", file)
  const proc = Bun.spawn(
    [
      chrome,
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "--virtual-time-budget=15000",
      `--screenshot=${dest}`,
      url,
    ],
    { stdout: "inherit", stderr: "inherit" }
  )
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`chrome exited ${code} for ${file}`)
  }
}

console.log(`wrote screenshots to ${outDir}`)
