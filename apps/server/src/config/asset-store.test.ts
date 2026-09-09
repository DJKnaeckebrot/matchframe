import { mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"

import {
  createFileAssetStore,
  detectImage,
  isSafeAssetId,
  MAX_ASSET_BYTES,
} from "./asset-store"

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])

describe("detectImage", () => {
  test("accepts png jpeg webp and plain svg", () => {
    expect(detectImage(PNG)?.contentType).toBe("image/png")
    expect(detectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe(
      "jpg"
    )
    const webp = new Uint8Array(12)
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(detectImage(webp)?.ext).toBe("webp")
    expect(detectImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))?.ext).toBe(
      "svg"
    )
  })

  test("rejects scripted svg and unknown bytes", () => {
    expect(
      detectImage(new TextEncoder().encode("<svg><script>alert(1)</script></svg>"))
    ).toBeNull()
    expect(detectImage(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))).toBeNull()
  })
})

describe("file asset store", () => {
  test("writes under a kind folder and refuses traversal ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matchframe-assets-"))
    const store = createFileAssetStore(dir)
    expect(isSafeAssetId("../theme")).toBe(false)
    const saved = await store.save("teams", "team-left-ab12cd34", PNG)
    expect(saved).toEqual({ id: "team-left-ab12cd34", kind: "teams", contentType: "image/png" })
    const read = await store.read("team-left-ab12cd34")
    expect(read?.contentType).toBe("image/png")
    expect(new Uint8Array(read?.body ?? new ArrayBuffer(0))).toEqual(PNG)
    expect(await store.read("../theme")).toBeNull()
  })

  test("replacing the same id drops the previous extension", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matchframe-assets-"))
    const store = createFileAssetStore(dir)
    await store.save("teams", "team-left-ab12cd34", PNG)
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")
    await store.save("teams", "team-left-ab12cd34", svg)
    const read = await store.read("team-left-ab12cd34")
    expect(read?.contentType).toBe("image/svg+xml")
    expect(await Bun.file(join(dir, "teams", "team-left-ab12cd34.png")).exists()).toBe(false)
  })

  test("delete removes the file so later reads miss", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matchframe-assets-"))
    const store = createFileAssetStore(dir)
    await store.save("sponsors", "sponsor-deadbeef", PNG)
    expect(await store.remove("sponsor-deadbeef")).toBe(true)
    expect(await store.read("sponsor-deadbeef")).toBeNull()
    expect(await store.remove("sponsor-deadbeef")).toBe(false)
  })

  test("refuses oversized payloads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matchframe-assets-"))
    const store = createFileAssetStore(dir)
    const huge = new Uint8Array(MAX_ASSET_BYTES + 1)
    huge.set(PNG)
    await expect(store.save("teams", "team-left-ab12cd34", huge)).rejects.toThrow("Image is too large")
  })

  test("missing kind folder does not throw on read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matchframe-assets-"))
    await mkdir(dir, { recursive: true })
    const store = createFileAssetStore(dir)
    expect(await store.read("team-left-missing")).toBeNull()
  })
})
