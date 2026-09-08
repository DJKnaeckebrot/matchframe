# Matchframe

Open-source CS2 esports broadcast overlays. Local-first: CS2 GSI in, normalized game state out.

## Development

```bash
bun install
bun run dev
```

This starts the dashboard, overlay, and broadcast server together.

| App | URL |
| --- | --- |
| Dashboard | http://localhost:5173 |
| Overlay (OBS browser source) | http://localhost:5174 |
| Broadcast server | http://localhost:3131 |
| GSI endpoint | `POST http://localhost:3131/api/gsi` |
| Theme | `GET` / `PUT http://localhost:3131/api/config/theme` |
| WebSocket | `ws://localhost:3131/ws` |

Point an OBS Browser Source at the overlay URL when you are ready to composite it over gameplay. Keep the source at 1920×1080 with a transparent background.

The overlay connects automatically. Override the server with `VITE_REALTIME_URL` (default `ws://localhost:3131/ws`).

The dashboard reads and writes overlay colors on the broadcast server (`http://localhost:3131`, override with `VITE_API_URL`). Use the Vite app at http://localhost:5173 — a `vite preview` tab on port 4173 is a static build and will miss `/api` unless the server is reachable.

Appearance colors are edited in the dashboard and applied to the running overlay over the same WebSocket.

### Preview without CS2

Post a GSI fixture to the running server:

```bash
bun run fixture:gsi
bun run fixture:gsi healthy
bun run fixture:gsi freeze
bun run fixture:gsi 4v5
bun run fixture:gsi 1v2
bun run fixture:gsi bomb-planted
bun run fixture:gsi bomb-low-time
bun run fixture:gsi bomb-defusing
bun run fixture:gsi bomb-defusing-low-time
bun run fixture:gsi bomb-defused
bun run fixture:gsi bomb-exploded
bun run fixture:gsi round-ct-win
bun run fixture:gsi round-t-win
bun run fixture:gsi round-over-bomb-defused
bun run fixture:gsi sides-switched-live
bun run fixture:gsi sides-switched-bomb-planted
bun run fixture:gsi sides-switched-defusing
bun run fixture:gsi equipment
bun run fixture:gsi observer
bun run fixture:gsi demo:defuse
```

`live` is the default. Apply `live` first, then `sides-switched-live`, to preview a halftime swap without moving logical teams. After `round-ct-win`, post `freeze` to confirm the round-result banner clears. After `bomb-planted`, post `bomb-defusing` so the engine can keep the plant timer while the defuse bar appears. Apply `live` or `bomb-planted` before the `sides-switched-bomb-*` fixtures so logical team order is already established.

`demo:defuse` posts `bomb-planted`, then `bomb-defusing`, then `bomb-defused` with short holds so the overlay can show plant, simultaneous bars, a freeze at DEFUSE 0.0, and the round result.

Round clocks and pause/timeout presentation require `phase_countdowns` in the CS2 GSI config. Fixtures include that block; a real match will not send it unless the cfg enables it.

### Workspace package reloads

`apps/server` uses `bun --watch`. Bun still warns that files under `packages/` sit outside the server project directory and will not be watched. After changing `packages/game-state` or `packages/gsi`, stop and re-run `bun run dev` from a fresh process, then refresh the overlay.

```bash
curl -s http://localhost:3131/health
curl -s http://localhost:3131/api/state
```

```bash
bun test
bun run typecheck
bun run build
```

## Adding dashboard components

```bash
bunx shadcn@latest add button -c apps/dashboard
```

Import from the shared UI package:

```tsx
import { Button } from "@workspace/ui/components/button"
```
