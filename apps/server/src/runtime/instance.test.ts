import { describe, expect, test } from "bun:test"

import { findRunningMatchframe, isAddrInUse } from "./instance"

describe("single instance", () => {
  test("detects EADDRINUSE without requiring a stack parse", () => {
    expect(isAddrInUse({ code: "EADDRINUSE" })).toBe(true)
    expect(isAddrInUse(new Error("Failed to start server. Is port 3131 in use?"))).toBe(true)
    expect(isAddrInUse(new Error("something else"))).toBe(false)
  })

  test("findRunningMatchframe is true only for a Matchframe health payload", async () => {
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (req) => {
        const url = new URL(req.url)
        if (url.pathname === "/health") {
          return Response.json({ status: "ok" })
        }
        return new Response(null, { status: 404 })
      },
    })
    try {
      expect(await findRunningMatchframe(`http://127.0.0.1:${server.port}`)).toBe(true)
      expect(await findRunningMatchframe("http://127.0.0.1:1")).toBe(false)
    } finally {
      server.stop(true)
    }
  })
})
