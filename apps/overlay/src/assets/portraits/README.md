# Overlay portrait artwork

`getPortraitAsset(id)` is the only overlay API for player portraits. Swap this
folder (or the mapping in `pack.ts`) without touching GameState or the
dashboard presentation model.

Current pack: `matchframe/` — Matchframe-owned silhouettes for development.
They are not Counter-Strike operator extracts.

To try Valve/community agent renders locally, drop files into
`cs2-reference/` and point `pack.ts` at that pack. Counter-Strike character
art remains property of Valve Corporation and must not ship as Matchframe's
own license.
