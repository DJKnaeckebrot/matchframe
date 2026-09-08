# Counter-Strike Reference Assets

The files in this directory originate from or are derived from Counter-Strike 2
game assets.

They are NOT licensed under Matchframe's MPL-2.0 license.

Counter-Strike and its game assets are property of Valve Corporation.

Source/reference:
https://github.com/Juknum/counter-strike-icons

These assets are kept separate from Matchframe-owned source code so they can be
replaced independently.

Do not assume that redistribution or commercial use of these assets is granted
by Matchframe's software license.

## Pack notes

Development/reference silhouettes used by the overlay HUD. Gun, nade, kit, and
C4 files from the equipment folder are bundled locally; knife skins and
unrelated panorama icons are not.

Upstream path: `cs2/panorama/images/icons/equipment`.

Matchframe does not treat these files as the product icon API. Overlay
components resolve **normalized Matchframe ids** (`ak47`, `flash`, `bomb`)
through `apps/overlay/src/icons`. Swap this folder (or point `icon-registry.ts`
at another pack) to replace artwork without changing player rows or game-state
types.
