# Tools

Dev tools and build scripts. The sprite assigner and dungeon cake each have their own `CONTEXT.md` with full documentation.

## Sprite Assigner (`sprite-assigner-v2/`)

Vite + React dev tool for managing the game's pixel-art sprite pipeline. Assign source sprites to TileTypes and DisplayGlyphs, author autotile variant sheets, and manage tileset registrations — all with direct file writes and live HMR updates to the running game.

**Start:** `cd tools/sprite-assigner-v2 && npm run dev`

See `sprite-assigner-v2/CONTEXT.md` for architecture, features, and how the tool connects to the game.

## Dungeon Cake (`dungeon-cake/`)

Standalone Vite + React dev tool for evaluating sprites in the context of real dungeon layouts. Generates levels on demand via `digDungeon`, renders at integer zoom (1x–4x) with the full layer compositing pipeline, and provides per-layer debug controls (visibility, tint, alpha, blend mode), lighting toggle, and fog-of-war mode selection.

**Start:** `cd tools/dungeon-cake && npm run dev`

See `dungeon-cake/CONTEXT.md` for architecture, features, roadmap, and how the tool connects to the game.

## Code Analysis (`analysis/`)

CLI tools for codebase analysis: a pre-computed C function manifest (818 functions with full call graphs), an on-demand TS stub scanner using the TypeScript compiler API, and a cross-reference layer that maps stubs to C functions and identifies critical-path gaps.

**Quick start:** `cd tools/analysis && npm install && npx tsx scan-stubs.ts && npx tsx port-health.ts`

See `analysis/CONTEXT.md` for full documentation, file layout, and example queries.

## Master Spritesheet Generator (`generate-master-spritesheet.mjs`)

Standalone Node CLI that builds `master-spritesheet.png` + `sprite-manifest.json` from hardcoded sprite assignments. Predates the sprite-assigner-v2's server-side generation and is largely superseded by it — the assigner does the same compositing via its "Save to Disk" button. Kept as a CLI fallback for scripted builds.

**Usage:** `node tools/generate-master-spritesheet.mjs` (from project root)

## Debug Autotile Generator (`gen-debug-autotile.py`)

Python script (requires Pillow) that generates a debug autotile spritesheet with variant index numbers and connectivity diagrams baked into each 16x16 cell. Useful for visually verifying the autotile system's variant selection in-game.

**Usage:** `python3 tools/gen-debug-autotile.py`

## Wang Blob Template Generator (`gen-wang-blob-template.py`)

Python script (requires Pillow) that generates a Wang Blob autotile template PNG — a 7×7 grid where the 47 connectivity variants are spatially arranged so adjacent tiles share visual connections. Each cell shows its variant index and a mini connectivity diagram. Configurable tile size (default 16×16). The artist draws directly on this template, and the sheet can be imported into the sprite assigner or loaded natively by the game.

**Usage:** `python3 tools/gen-wang-blob-template.py [--tile-size 32] [-o output.png]`

## Upstream Build Scripts

Inherited from BrogueCE's C build system. Not used by the TypeScript port.

- **`git-extra-version`** — Emits a dev version suffix (git hash + branch) for C build version strings.
- **`gha-release`** — GitHub Actions release testing: unzips platform artifacts and smoke-tests executables.
- **`bullet-points`** — Concatenates files to stdout. Utility script.
