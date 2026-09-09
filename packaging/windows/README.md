# Windows packaging

Used by `bun run release:windows` to produce a per-user installer and a
portable zip. Ordinary operators never need this folder.

## Inno Setup (maintainers)

The installer is compiled with [Inno Setup 6](https://jrsoftware.org/isinfo.php).
It is a maintainer/release-machine dependency only. Matchframe does not install
it on user PCs, and the release script will not download it.

1. Install Inno Setup 6 from https://jrsoftware.org/isdl.php
2. Ensure `ISCC.exe` is on `PATH`, or keep a default location:

   - `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`
   - `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`

   Or set `ISCC` to the full path of `ISCC.exe`.

3. `bun run build:installer` (or `bun run release:windows`)

The script fails with a short message if `ISCC` is missing.

## Code signing (not in this pipeline)

Unsigned Windows binaries may trigger SmartScreen / reputation warnings during
the alpha/beta. Do not add bypasses.

Insert signing later, in this order:

1. Build `Matchframe.exe`
2. Sign `Matchframe.exe`
3. Build the portable zip and the Inno Setup installer
4. Sign `Matchframe-Setup-<version>-win-x64.exe`

## Console window

Release compilation passes Bun's `windows.hideConsole` flag. If a given Bun
version still opens a console for compiled executables, leave it — do not patch
PE headers. Runtime diagnostics go to the log file.
