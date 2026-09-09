import { describe, expect, test } from "bun:test"

import { broadcastOrigin, realtimeUrl } from "./server-origin"

describe("overlay server origin", () => {
  test("development keeps the Vite-era broadcast server defaults", () => {
    expect(broadcastOrigin()).toBe("http://localhost:3131")
    expect(realtimeUrl()).toBe("ws://localhost:3131/ws")
  })
})
