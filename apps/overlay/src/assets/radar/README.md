# Overlay radar artwork

The files in this directory originate from or are derived from Counter-Strike 2
game assets.

They are NOT licensed under Matchframe's MPL-2.0 license.

Counter-Strike and its game assets are property of Valve Corporation.

These assets are kept separate from Matchframe-owned source code so they can be
replaced independently.

Do not assume that redistribution or commercial use of these assets is granted
by Matchframe's software license.

## Pack notes

`getRadarAsset(mapId)` is the only overlay API for radar images. Swap this
folder (or the mapping in `pack.ts`) without touching `packages/maps` or
GameState.

v1 maps `de_anubis` → `de_anubis_radar_psd.png` (local CS2 overview extract).
Other PNGs in this folder are unused until `packages/maps` has metadata for
that map. Extra files do not make the radar appear.

Do not fetch radar artwork from GitHub or a CDN at runtime.
