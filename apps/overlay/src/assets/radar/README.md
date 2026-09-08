# Overlay radar artwork

`getRadarAsset(mapId)` is the only overlay API for radar images. Swap this
folder (or the mapping in `pack.ts`) without touching `packages/maps` or
GameState.

v1 maps `de_anubis` → `de_anubis_radar_psd.png` (local CS2 overview extract).
Other PNGs in this folder are unused until `packages/maps` has metadata for
that map. Extra files do not make the radar appear.

Counter-Strike radar artwork is a Valve asset. Do not fetch it from GitHub or
a CDN at runtime.
