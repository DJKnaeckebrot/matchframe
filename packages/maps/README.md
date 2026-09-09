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
- **`scale`**: world units per pixel at the authored image size (1024×1024)
- **`rotate`**: unused on the active-duty pool (0 / omitted). A non-zero value
  throws until a rotated map is implemented — the transform owns this, not CSS
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
against a replaceable local mapping. Development artwork is extracted CS2 radar
(Valve). See `apps/overlay/src/assets/radar/README.md`.

Active duty: Ancient, Anubis, Inferno, Mirage, Nuke, Overpass, Vertigo.

## Levels

`MapMetadata.levels` comes from Valve `verticalsections`. Nuke and Vertigo have
an upper (`default`) and `lower` floor. `getMapLevelForZ` uses
`altitudeMin < z <= altitudeMax`. XY transform is the same on both floors;
the overlay swaps the radar image.

## Grenades

World grenades live on `GameState.worldGrenades`. Overlay radar converts their
world position with `worldToRadar` inside `getRadarGrenades` — not in JSX.
Area size uses `worldRadiusToRadar` (world units → normalized image radius).
Inferno flame anchors are transformed the same way into `flamePoints`.
