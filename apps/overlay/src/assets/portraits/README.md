# Overlay portrait artwork

`getPortraitAsset(id)` returns a local broadcast-server URL
(`/api/portraits/:id`). The overlay never fetches csgodatabase, Steam, or
other remote hosts.

CS2 agent inventory renders are imported with `bun run portraits:import` into
`apps/server/data/portraits` (gitignored). Counter-Strike character art
remains property of Valve Corporation and is not committed to this repo.

Matchframe SVG silhouettes in `matchframe/` are unused at runtime once the
local PNG pack is present.
