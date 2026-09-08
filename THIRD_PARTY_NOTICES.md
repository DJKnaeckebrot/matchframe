# Third-Party Notices

Matchframe contains or depends on third-party software and assets that are
licensed separately from Matchframe itself.

Unless otherwise stated, the Mozilla Public License 2.0 applying to Matchframe
does not grant any rights to third-party software, trademarks, game assets,
artwork, icons, character renders, or other materials listed below.

## @counter-strike-2-gsi/server

Matchframe uses `@counter-strike-2-gsi/server` for merging incremental
Counter-Strike 2 Game State Integration payloads.

Project:
https://github.com/mverissimo/counter-strike-2-gsi

Copyright (c) 2026 Matheus Verissimo

License: MIT

The MIT license and copyright notice distributed with this dependency remain
applicable to that software.

Matchframe does not claim ownership of `@counter-strike-2-gsi/server`.

---

## Counter-Strike icon assets

Some development or reference assets used by Matchframe may originate from:

https://github.com/Juknum/counter-strike-icons

The repository contains assets automatically extracted from Counter-Strike 2
game files.

Its code and tooling are licensed separately under the MIT License.

The Counter-Strike icon assets themselves are the property of Valve Corporation
and are not covered by the MIT license of that repository or by Matchframe's
Mozilla Public License 2.0.

The upstream project states that these game assets are provided for
informational and community purposes and are not licensed for commercial use
without explicit permission from Valve Corporation.

Reference copies used by the overlay live in
`apps/overlay/src/assets/icon-packs/cs2-reference/`. See that folder's README.

Counter-Strike is a trademark of Valve Corporation.

---

## Counter-Strike game assets

Matchframe may optionally use Counter-Strike-derived assets during development,
including, for example:

- weapon icons
- grenade and equipment icons
- operator / agent renders
- radar overview artwork
- Counter-Strike user-interface imagery

These assets are not original Matchframe assets.

All Counter-Strike game assets and associated intellectual property remain the
property of Valve Corporation and/or their respective rights holders.

They are not licensed under MPL-2.0 merely because they appear in or are used
with Matchframe.

Matchframe's architecture intentionally keeps game assets behind replaceable
asset abstractions so deployments may substitute independently licensed or
original assets.

See `apps/overlay/src/assets/README.md` for where those files live.

---

## Valve / Counter-Strike affiliation

Matchframe is an independent community project.

Matchframe is not affiliated with, endorsed by, sponsored by, or approved by
Valve Corporation.

Counter-Strike, Counter-Strike 2, Steam, and related names, trademarks, logos,
game assets, and intellectual property belong to Valve Corporation and/or their
respective rights holders.

---

## Other dependencies

Additional third-party dependencies are governed by the licenses included with
those dependencies.

Where required, their copyright notices and license terms must be preserved
when Matchframe is redistributed.