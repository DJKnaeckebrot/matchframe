import { mkdir, writeFile } from "node:fs/promises"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"

import { generateEmbeddedModule } from "./embed-web"

describe("embedded frontend manifest", () => {
  test("generates file imports for dashboard and overlay assets", async () => {
    const root = await mkdtemp(join(tmpdir(), "matchframe-embed-"))
    await mkdir(join(root, "dashboard", "assets"), { recursive: true })
    await mkdir(join(root, "overlay"), { recursive: true })
    await writeFile(join(root, "dashboard", "index.html"), "<html></html>")
    await writeFile(join(root, "dashboard", "assets", "app.js"), "console.log(1)")
    await writeFile(join(root, "overlay", "index.html"), "<html></html>")
    const source = await generateEmbeddedModule(root, "../../../../dist/compile-assets/web")
    expect(source).toContain('import d0 from "../../../../dist/compile-assets/web/dashboard/assets/app.js" with { type: "file" }')
    expect(source).toContain('import o0 from "../../../../dist/compile-assets/web/overlay/index.html" with { type: "file" }')
    expect(source).toContain('"index.html": o0')
  })
})
