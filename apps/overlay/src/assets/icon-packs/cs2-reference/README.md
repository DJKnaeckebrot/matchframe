# CS2 reference icon pack

Development/reference silhouettes used by the overlay HUD. Gun, nade, kit, and C4 files from the equipment folder are bundled locally; knife skins and unrelated panorama icons are not.

Source: [Juknum/counter-strike-icons](https://github.com/Juknum/counter-strike-icons), path `cs2/panorama/images/icons/equipment`.

That repository states that Counter-Strike assets remain property of Valve Corporation and are intended for community / educational use.

Matchframe does not treat these files as the product icon API. Overlay components resolve **normalized Matchframe ids** (`ak47`, `flash`, `bomb`) through `apps/overlay/src/icons`. Swap this folder (or point `icon-registry.ts` at another pack) to replace artwork without changing player rows or game-state types.
