import { describe, expect, test } from "bun:test"

import { resolveOverlayPublicUrl } from "./overlay-url.ts"

describe("overlay public URL", () => {
  test("development uses the Vite overlay port on the current hostname", () => {
    expect(
      resolveOverlayPublicUrl({
        production: false,
        location: { protocol: "http:", hostname: "localhost", origin: "http://localhost:5173" },
      })
    ).toBe("http://localhost:5174")
  })

  test("production uses the same-origin /overlay path, never the Vite port", () => {
    expect(
      resolveOverlayPublicUrl({
        production: true,
        location: { protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:3131" },
      })
    ).toBe("http://127.0.0.1:3131/overlay")
  })
})
