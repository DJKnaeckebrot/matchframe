# Matchframe

Open-source CS2 esports broadcast overlays. Local-first: CS2 GSI in, normalized game state out.

## Development

```bash
bun install
bun run dev
```

This starts the dashboard (Vite) and the broadcast server together. The server listens on port 3131.

```
Broadcast server running at http://localhost:3131
GSI endpoint: http://localhost:3131/api/gsi
```

Post the included GSI fixture, then read back normalized state:

```bash
curl -s http://localhost:3131/health

curl -s -X POST http://localhost:3131/api/gsi \
  -H "Content-Type: application/json" \
  --data-binary @packages/gsi/fixtures/inferno-live.json

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
