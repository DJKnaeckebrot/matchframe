import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import {
  PRODUCT_COPYRIGHT,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_PUBLISHER,
  PRODUCT_VERSION,
  windowsFileVersion,
} from "../apps/server/src/product"
import { writeMatchframeIcon } from "../packaging/windows/write-icon"
import { generateEmbeddedModule } from "./lib/embed-web"
import {
  artifactNames,
  formatSha256Sums,
  isccMissingMessage,
  isForbiddenReleasePath,
  PORTABLE_FILENAMES,
} from "./lib/release"

const repoRoot = resolve(import.meta.dir, "..")
const runtimeDir = join(repoRoot, "dist", "runtime")
const compileWebDir = join(repoRoot, "dist", "compile-assets", "web")
const releaseDir = join(repoRoot, "dist", "release")
const portableStageDir = join(repoRoot, "dist", "portable-stage", "Matchframe")
const exePath = join(runtimeDir, "Matchframe.exe")
const issPath = join(repoRoot, "packaging", "windows", "matchframe.iss")
const names = artifactNames(PRODUCT_VERSION)

type Args = {
  exe: boolean
  portable: boolean
  installer: boolean
  smoke: boolean
}

function parseArgs(argv: readonly string[]): Args {
  const flags = new Set(argv.slice(2))
  const requested = flags.has("--exe") || flags.has("--portable") || flags.has("--installer")
  if (!requested) {
    return { exe: true, portable: true, installer: true, smoke: true }
  }
  return {
    exe: flags.has("--exe") || flags.has("--portable") || flags.has("--installer"),
    portable: flags.has("--portable"),
    installer: flags.has("--installer"),
    smoke: flags.has("--smoke"),
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  console.log(`Matchframe ${PRODUCT_VERSION}`)
  await ensureFrontend()
  if (args.exe) {
    await compileExe()
  }
  if (args.portable) {
    await stagePortable()
  }
  if (args.installer) {
    await compileInstaller()
  }
  await writeChecksums()
  printArtifacts()
  if (args.smoke) {
    const smoke = Bun.spawn(["bun", "run", join(repoRoot, "scripts", "smoke-standalone.ts"), "--exe", exePath], {
      cwd: repoRoot,
      stdout: "inherit",
      stderr: "inherit",
    })
    const code = await smoke.exited
    if (code !== 0) {
      fail(`Standalone smoke test failed (${String(code)})`)
    }
  }
}

async function ensureFrontend(): Promise<void> {
  const dashboard = join(repoRoot, "apps", "dashboard", "dist", "index.html")
  const overlay = join(repoRoot, "apps", "overlay", "dist", "index.html")
  if (!existsSync(dashboard) || !existsSync(overlay)) {
    console.log("Building dashboard and overlay…")
    await runOk(["bun", "run", "build"], repoRoot)
  }
  if (!existsSync(dashboard) || !existsSync(overlay)) {
    fail("Frontend production builds are missing. Run bun run build.")
  }
}

async function compileExe(): Promise<void> {
  await rm(compileWebDir, { recursive: true, force: true })
  await rm(runtimeDir, { recursive: true, force: true })
  await mkdir(join(compileWebDir, "dashboard"), { recursive: true })
  await mkdir(join(compileWebDir, "overlay"), { recursive: true })
  await copyWeb(join(repoRoot, "apps", "dashboard", "dist"), join(compileWebDir, "dashboard"))
  await copyWeb(join(repoRoot, "apps", "overlay", "dist"), join(compileWebDir, "overlay"))
  await mkdir(runtimeDir, { recursive: true })
  const icon = await writeMatchframeIcon(join(repoRoot, "packaging", "windows"))
  const embeddedPath = join(repoRoot, "apps", "server", "src", "web", "embedded.ts")
  const stub = await Bun.file(embeddedPath).text()
  await Bun.write(
    embeddedPath,
    await generateEmbeddedModule(compileWebDir, "../../../../dist/compile-assets/web")
  )
  console.log("Compiling Matchframe.exe (Bun runtime is embedded)…")
  // TODO(signing): sign Matchframe.exe here before portable zip / installer.
  try {
    const result = await Bun.build({
      entrypoints: [join(repoRoot, "apps", "server", "src", "index.ts")],
      compile: {
        outfile: join(runtimeDir, "Matchframe"),
        target: "bun-windows-x64",
        windows: {
          hideConsole: true,
          icon,
          title: PRODUCT_NAME,
          publisher: PRODUCT_PUBLISHER,
          version: windowsFileVersion(PRODUCT_VERSION),
          description: PRODUCT_DESCRIPTION,
          copyright: PRODUCT_COPYRIGHT,
        },
      },
    })
    if (!result.success) {
      for (const log of result.logs) {
        console.error(log)
      }
      fail("bun build --compile failed")
    }
  } finally {
    await Bun.write(embeddedPath, stub)
  }
  if (!existsSync(exePath)) {
    fail(`Expected ${exePath}`)
  }
  console.log(`Wrote ${exePath}`)
}

async function stagePortable(): Promise<void> {
  if (!existsSync(exePath)) {
    fail("Matchframe.exe is missing. Compile it first.")
  }
  await rm(dirname(portableStageDir), { recursive: true, force: true })
  await mkdir(portableStageDir, { recursive: true })
  await cp(exePath, join(portableStageDir, "Matchframe.exe"))
  await cp(join(repoRoot, "packaging", "windows", "PORTABLE-README.txt"), join(portableStageDir, "README.txt"))
  await cp(join(repoRoot, "LICENSE"), join(portableStageDir, "LICENSE"))
  await cp(join(repoRoot, "THIRD_PARTY_NOTICES.md"), join(portableStageDir, "THIRD_PARTY_NOTICES.md"))
  await writeFile(join(portableStageDir, "portable.flag"), "")
  const staged = await listFiles(portableStageDir)
  const forbidden = staged.filter((file) => isForbiddenReleasePath(file))
  if (forbidden.length > 0) {
    fail(`Portable stage contains excluded paths:\n${forbidden.join("\n")}`)
  }
  for (const name of PORTABLE_FILENAMES) {
    if (!existsSync(join(portableStageDir, name))) {
      fail(`Portable stage is missing ${name}`)
    }
  }
  await mkdir(releaseDir, { recursive: true })
  const zipPath = join(releaseDir, names.portable)
  await rm(zipPath, { force: true })
  await zipDirectory(dirname(portableStageDir), "Matchframe", zipPath)
  console.log(`Wrote ${zipPath}`)
}

async function compileInstaller(): Promise<void> {
  if (!existsSync(exePath)) {
    fail("Matchframe.exe is missing. Compile it first.")
  }
  const iscc = findIscc()
  if (!iscc) {
    fail(isccMissingMessage())
  }
  await writeMatchframeIcon(join(repoRoot, "packaging", "windows"))
  await mkdir(releaseDir, { recursive: true })
  // TODO(signing): sign the installer after ISCC completes.
  await runOk(
    [
      iscc,
      issPath,
      `/DMatchframeVersion=${PRODUCT_VERSION}`,
      `/DMatchframeFileVersion=${windowsFileVersion(PRODUCT_VERSION)}`,
      `/DMatchframeExe=${exePath}`,
    ],
    repoRoot
  )
  const setup = join(releaseDir, names.setup)
  if (!existsSync(setup)) {
    fail(`Expected installer at ${setup}`)
  }
  console.log(`Wrote ${setup}`)
}

async function writeChecksums(): Promise<void> {
  if (!existsSync(releaseDir)) {
    return
  }
  const files = [names.setup, names.portable].filter((name) => existsSync(join(releaseDir, name)))
  if (files.length === 0) {
    return
  }
  const entries = []
  for (const filename of files) {
    const bytes = await Bun.file(join(releaseDir, filename)).arrayBuffer()
    const hasher = new Bun.CryptoHasher("sha256")
    hasher.update(bytes)
    entries.push({ hash: hasher.digest("hex"), filename })
  }
  await Bun.write(join(releaseDir, names.checksums), formatSha256Sums(entries))
  console.log(`Wrote ${join(releaseDir, names.checksums)}`)
}

function printArtifacts(): void {
  console.log("Artifacts:")
  for (const name of [names.setup, names.portable, names.checksums]) {
    const path = join(releaseDir, name)
    if (existsSync(path)) {
      console.log(`  ${path}`)
    }
  }
  if (existsSync(exePath)) {
    console.log(`  ${exePath}`)
  }
}

function findIscc(): string | null {
  const fromEnv = process.env.ISCC?.trim()
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv
  }
  const which = Bun.which("ISCC") ?? Bun.which("iscc")
  if (which) {
    return which
  }
  const localApp = process.env.LOCALAPPDATA?.trim()
  const known = [
    "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
    ...(localApp ? [join(localApp, "Programs", "Inno Setup 6", "ISCC.exe")] : []),
  ]
  return known.find((path) => existsSync(path)) ?? null
}

async function copyWeb(src: string, dest: string): Promise<void> {
  await cp(src, dest, {
    recursive: true,
    filter: (source) => !source.endsWith(".map"),
  })
}

async function listFiles(root: string, prefix = "Matchframe"): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      out.push(...(await listFiles(join(root, entry.name), relative)))
    } else {
      out.push(relative)
    }
  }
  return out
}

async function zipDirectory(parent: string, folder: string, zipPath: string): Promise<void> {
  const tar = Bun.which("tar")
  if (tar) {
    await runOk([tar, "-a", "-c", "-f", zipPath, "-C", parent, folder], parent)
    return
  }
  await runOk(
    [
      "powershell",
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path ${JSON.stringify(join(parent, folder))} -DestinationPath ${JSON.stringify(zipPath)}`,
    ],
    parent
  )
}

async function runOk(cmd: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" })
  const code = await proc.exited
  if (code !== 0) {
    fail(`Command failed (${String(code)}): ${cmd.join(" ")}`)
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

void main()
