# Overlay portrait artwork

`getPortraitAsset(id)` returns a local broadcast-server URL
(`/api/portraits/:id`). The overlay never fetches csgodatabase, Steam, or
other remote hosts.

CS2 agent inventory renders are imported with `bun run portraits:import` into
`apps/server/data/portraits` (gitignored). They are not licensed under
Matchframe's MPL-2.0 license. Counter-Strike character art remains property of
Valve Corporation and is not committed to this repo. See
`cs2-reference/README.md`.

Matchframe SVG silhouettes in `matchframe/` are unused at runtime once the
local PNG pack is present.
