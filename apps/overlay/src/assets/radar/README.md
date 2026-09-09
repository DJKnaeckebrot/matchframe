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

`getRadarAsset(mapId, levelId?)` is the only overlay API for radar images. Swap this
folder (or the mapping in `pack.ts`) without touching `packages/maps` or
GameState. Nuke/Vertigo pass `lower` for the basement/lower stack.

v1 maps the active-duty pool:

- `de_ancient` → `de_ancient_radar_psd.png`
- `de_anubis` → `de_anubis_radar_psd.png`
- `de_inferno` → `de_inferno_radar_psd.png`
- `de_mirage` → `de_mirage_radar_psd.png`
- `de_nuke` → `de_nuke_radar_psd.png` / `de_nuke_lower_radar_psd.png`
- `de_overpass` → `de_overpass_radar_psd.png`
- `de_vertigo` → `de_vertigo_radar_psd.png` / `de_vertigo_lower_radar_psd.png`

(local CS2 overview extracts). Other PNGs in this folder are unused until
`packages/maps` has metadata for that map. Extra files do not make the radar
appear.

Do not fetch radar artwork from GitHub or a CDN at runtime.
