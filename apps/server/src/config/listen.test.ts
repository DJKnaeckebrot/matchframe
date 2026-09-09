import { describe, expect, test } from "bun:test"

import {
  dashboardPublicUrl,
  DEFAULT_HOST,
  DEFAULT_PORT,
  gsiEndpointUri,
  listenHost,
  listenPort,
  overlayPublicUrl,
  websocketPublicUrl,
} from "./listen"

describe("listen", () => {
  test("defaults to loopback port 3131", () => {
    const env = {}
    expect(listenPort(env)).toBe(DEFAULT_PORT)
    expect(listenHost(env)).toBe(DEFAULT_HOST)
    expect(dashboardPublicUrl(DEFAULT_PORT, env)).toBe("http://127.0.0.1:3131/")
    expect(overlayPublicUrl(DEFAULT_PORT, env)).toBe("http://127.0.0.1:3131/overlay")
    expect(gsiEndpointUri(DEFAULT_PORT)).toBe("http://127.0.0.1:3131/api/gsi")
    expect(websocketPublicUrl(DEFAULT_PORT, env)).toBe("ws://127.0.0.1:3131/ws")
  })

  test("PORT overrides the listen port used by dashboard, overlay, and GSI URLs", () => {
    const env = { PORT: "4000" }
    expect(listenPort(env)).toBe(4000)
    expect(overlayPublicUrl(listenPort(env), env)).toBe("http://127.0.0.1:4000/overlay")
    expect(gsiEndpointUri(listenPort(env))).toBe("http://127.0.0.1:4000/api/gsi")
  })

  test("wildcard bind still advertises loopback URLs", () => {
    const env = { MATCHFRAME_HOST: "0.0.0.0" }
    expect(listenHost(env)).toBe("0.0.0.0")
    expect(dashboardPublicUrl(DEFAULT_PORT, env)).toBe("http://127.0.0.1:3131/")
    expect(overlayPublicUrl(DEFAULT_PORT, env)).toBe("http://127.0.0.1:3131/overlay")
  })
})
