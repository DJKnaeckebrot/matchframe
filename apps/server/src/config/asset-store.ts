import { mkdir, readdir, unlink } from "node:fs/promises"
import { join } from "node:path"
import { localAssetIdSchema } from "@workspace/presentation"

export const ASSET_KINDS = ["teams", "sponsors"] as const

export type AssetKind = (typeof ASSET_KINDS)[number]

export type StoredAssetFile = {
  body: ArrayBuffer
  contentType: string
}

export type SavedAsset = {
  id: string
  kind: AssetKind
  contentType: string
}

export const MAX_ASSET_BYTES = 2 * 1024 * 1024

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10]
const EXTS = ["png", "jpg", "webp", "svg"] as const

export type DetectedImage = {
  ext: (typeof EXTS)[number]
  contentType: string
}

export type AssetStore = {
  save(kind: AssetKind, id: string, bytes: Uint8Array): Promise<SavedAsset>
  read(id: string): Promise<StoredAssetFile | null>
  remove(id: string): Promise<boolean>
}

export function isSafeAssetId(id: string): boolean {
  return localAssetIdSchema.safeParse(id).success
}

export function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (bytes.length < 12) {
    return null
  }
  if (startsWith(bytes, PNG_SIG)) {
    return { ext: "png", contentType: "image/png" }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" }
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" }
  }
  if (isSafeSvg(bytes)) {
    return { ext: "svg", contentType: "image/svg+xml" }
  }
  return null
}

export function createFileAssetStore(dir: string): AssetStore {
  return {
    async save(kind, id, bytes) {
      if (!isSafeAssetId(id)) {
        throw new Error("Invalid asset id")
      }
      if (bytes.byteLength > MAX_ASSET_BYTES) {
        throw new Error("Image is too large")
      }
      const detected = detectImage(bytes)
      if (!detected) {
        throw new Error("Unsupported image type")
      }
      await mkdir(kindDir(dir, kind), { recursive: true })
      await removeById(dir, id)
      const file = join(kindDir(dir, kind), `${id}.${detected.ext}`)
      await Bun.write(file, bytes)
      return { id, kind, contentType: detected.contentType }
    },
    async read(id) {
      const file = await findById(dir, id)
      if (!file) {
        return null
      }
      const body = await Bun.file(file.path).arrayBuffer()
      return { body, contentType: file.contentType }
    },
    async remove(id) {
      return removeById(dir, id)
    },
  }
}

export function newTeamLogoId(slot: "left" | "right"): string {
  return `team-${slot}-${randomSuffix()}`
}

export function newSponsorId(): string {
  return `sponsor-${randomSuffix()}`
}

function randomSuffix(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8)
}

function kindDir(root: string, kind: AssetKind): string {
  return join(root, kind)
}

async function findById(
  root: string,
  id: string
): Promise<{ path: string; contentType: string } | null> {
  if (!isSafeAssetId(id)) {
    return null
  }
  for (const kind of ASSET_KINDS) {
    const found = await findInKind(root, kind, id)
    if (found) {
      return found
    }
  }
  return null
}

async function findInKind(
  root: string,
  kind: AssetKind,
  id: string
): Promise<{ path: string; contentType: string } | null> {
  const dir = kindDir(root, kind)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return null
  }
  const prefix = `${id}.`
  const match = names.find((name) => name.startsWith(prefix) && !name.includes("/") && !name.includes("\\"))
  if (!match) {
    return null
  }
  const ext = match.slice(prefix.length)
  const contentType = contentTypeForExt(ext)
  if (!contentType) {
    return null
  }
  return { path: join(dir, match), contentType }
}

async function removeById(root: string, id: string): Promise<boolean> {
  const found = await findById(root, id)
  if (!found) {
    return false
  }
  await unlink(found.path)
  return true
}

function contentTypeForExt(ext: string): string | null {
  if (ext === "png") {
    return "image/png"
  }
  if (ext === "jpg") {
    return "image/jpeg"
  }
  if (ext === "webp") {
    return "image/webp"
  }
  if (ext === "svg") {
    return "image/svg+xml"
  }
  return null
}

function startsWith(bytes: Uint8Array, sig: readonly number[]): boolean {
  return sig.every((value, index) => bytes[index] === value)
}

function isSafeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8").decode(bytes.slice(0, 256)).trimStart().toLowerCase()
  const looksLikeSvg =
    head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))
  if (!looksLikeSvg) {
    return false
  }
  const full = new TextDecoder("utf-8").decode(bytes).toLowerCase()
  return !full.includes("<script") && !/\bon\w+\s*=/.test(full)
}
