# CS2 reference portrait pack

Optional local development slot for extracted Counter-Strike / Valve operator
renders.

This folder is intentionally empty in the repository. Matchframe core
presentation logic resolves **stable operator ids** (`ct_default_01`,
`t_default_01`, `neutral`) through `pack.ts`. It does not inspect filenames
or Valve asset paths.

If you add extracted CS2 character art here for local comparison:

- keep it out of git
- do not treat it as redistributable Matchframe artwork
- Counter-Strike assets remain property of Valve Corporation

Swap `apps/overlay/src/assets/portraits/pack.ts` to this pack when you have
local files. Broadcast still works offline; portraits are never fetched from
a URL.
