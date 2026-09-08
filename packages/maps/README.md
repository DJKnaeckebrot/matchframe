# packages/maps

Game-independent map metadata and spatial helpers. No React. No Valve GSI types.

`packages/game-state` stays free of radar artwork and overview files. The overlay
asks this package for metadata, then maps a map id to a local image.

## Coordinate conventions

CS2 world (Source):

- **+X** east
- **+Y** north
- **+Z** up

Valve overview (`resource/overviews/<map>.txt`):

- **`pos_x` / `pos_y`**: world XY of the radar image's **top-left** pixel
- **`scale`**: world units per pixel at the authored image size (1024×1024 for Anubis)
- **`rotate`**: unused on Anubis (treated as 0). A non-zero value throws until a
  rotated map is implemented — the transform owns this, not CSS
- Radar image **+X** right, **+Y** down

Transform (`worldToRadar`):

```
x = (worldX - posX) / (scale * width)
y = (posY - worldY) / (scale * height)
```

`x`/`y` are **unclamped** normalized image coordinates. `0..1` is on the artwork.
The overlay may clamp for CSS positioning; this function does not.

Facing (`getFacingAngle`): clockwise degrees from world **+Y** (north). Apply
with CSS `rotate()` on an **up-pointing** marker only. Do not rotate the radar
image or labels.

## Radar assets

This package does **not** load images. Overlay code calls `getRadarAsset(mapId)`
against a replaceable local mapping. Development Anubis artwork is extracted
CS2 radar (Valve). See `apps/overlay/src/assets/radar/README.md`.

## Levels

`MapMetadata.levels` is reserved for stacked floors (Nuke, Vertigo). v1 uses
the primary `radar` layer only.

## Grenades

World grenades live on `GameState.worldGrenades`. Overlay radar converts their
world position with `worldToRadar` inside `getRadarGrenades` — not in JSX.
Molotov flame points are a later slice; do not treat every nade as a circle.
