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

Appearance colors are edited in the dashboard and applied to the running overlay over the same WebSocket.

### Preview without CS2

Post a GSI fixture to the running server:

```bash
bun run fixture:gsi
bun run fixture:gsi healthy
bun run fixture:gsi damaged
bun run fixture:gsi dead
bun run fixture:gsi sides-switched
bun run fixture:gsi equipment
bun run fixture:gsi observer
```

`live` is the default. Apply `live` first, then `sides-switched`, to preview a halftime swap without moving logical teams.

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
