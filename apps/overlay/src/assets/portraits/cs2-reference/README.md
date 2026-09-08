# Counter-Strike Reference Assets

This directory is reserved for Counter-Strike 2 operator / agent renders.

They are NOT licensed under Matchframe's MPL-2.0 license.

Counter-Strike and its game assets are property of Valve Corporation.

These assets are kept separate from Matchframe-owned source code so they can be
replaced independently.

Do not assume that redistribution or commercial use of these assets is granted
by Matchframe's software license.

Operator inventory renders are **not committed**. Import them locally with
`bun run portraits:import` (writes into `apps/server/data/portraits`, gitignored).

This folder is unused at runtime. The overlay resolves **stable operator ids**
(`ctm_sas_variantf`, `tm_phoenix_varianth`, …) through `getPortraitAsset` →
`GET /api/portraits/:id` on the local broadcast server.

Do not point the overlay at csgodatabase, Steam, or any other remote host.
