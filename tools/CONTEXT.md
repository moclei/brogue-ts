# Tools

Dev tools and build scripts. The sprite-assigner-v2 has its own `CONTEXT.md` with full documentation.

## Sprite Assigner (`sprite-assigner-v2/`)

Vite + React dev tool for managing the game's pixel-art sprite pipeline. Assign source sprites to TileTypes and DisplayGlyphs, author autotile variant sheets, and manage tileset registrations — all with direct file writes and live HMR updates to the running game.

**Start:** `cd tools/sprite-assigner-v2 && npm run dev`

See `sprite-assigner-v2/CONTEXT.md` for architecture, features, and how the tool connects to the game.

## Master Spritesheet Generator (`generate-master-spritesheet.mjs`)

Standalone Node CLI that builds `master-spritesheet.png` + `sprite-manifest.json` from hardcoded sprite assignments. Predates the sprite-assigner-v2's server-side generation and is largely superseded by it — the assigner does the same compositing via its "Save to Disk" button. Kept as a CLI fallback for scripted builds.

**Usage:** `node tools/generate-master-spritesheet.mjs` (from project root)

## Debug Autotile Generator (`gen-debug-autotile.py`)

Python script (requires Pillow) that generates a debug autotile spritesheet with variant index numbers and connectivity diagrams baked into each 16x16 cell. Useful for visually verifying the autotile system's variant selection in-game.

**Usage:** `python tools/gen-debug-autotile.py`

## Upstream Build Scripts

Inherited from BrogueCE's C build system. Not used by the TypeScript port.

- **`git-extra-version`** — Emits a dev version suffix (git hash + branch) for C build version strings.
- **`gha-release`** — GitHub Actions release testing: unzips platform artifacts and smoke-tests executables.
- **`bullet-points`** — Concatenates files to stdout. Utility script.
