# CS2 reference portrait pack

This folder is unused at runtime. CS2 agent art is imported into
`apps/server/data/portraits` (gitignored) via `bun run portraits:import`.

The overlay resolves **stable operator ids** (`ctm_sas_variantf`,
`tm_phoenix_varianth`, …) through `getPortraitAsset` →
`GET /api/portraits/:id` on the local broadcast server.

Do not point the overlay at csgodatabase, Steam, or any other remote host.
Counter-Strike assets remain property of Valve Corporation.
