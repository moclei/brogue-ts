# Sprite Loading Consolidation — Tasks

## Phase 1: Fix the immediate chasm sheet mismatch
- [x] Change tileset-loader.ts chasm import from `raw-autotile/chasm-autotile-v3.png` to `autotile/chasm-autotile.png`
- [x] Fix `AUTOTILE_SHEETS` format: `"wang-blob"` → `"grid"` (the loaded sheet is now the 8×6 grid, not the Wang Blob source)
- [ ] Verify chasm autotile renders correctly in-game

# --- handoff point ---

## Phase 2: New autotile schema + data-driven image loading
- [x] Define new `autotile` schema type in `glyph-sprite-map.ts`: per-group `{ sheet: string, format: "grid" | "wang" }` instead of per-variant arrays
- [x] Add `sheets` section type (`{ master: string }`) to `AssignmentsData`
- [x] Hand-write the new `autotile` + `sheets` sections in `assignments.json` for WALL, FLOOR, CHASM
- [x] Rewrite `tileset-loader.ts`: remove static `?url` imports, load image paths from assignments.json (`sheets` for master, `autotile` for per-group sheets)
- [x] Update `buildAutotileVariantMap()`: read per-group `{ sheet, format }` from assignments.json, use `gridVariants()` for "grid" / `wangVariants()` for "wang"
- [x] Remove `AUTOTILE_SHEETS`, `SHEET_NAME_MAP`, `assignmentVariants()`, `resolveGroupVariants()`
- [x] Update `bootstrap.ts` HMR handler: re-fetch assignments.json on reload, pass to loader + map builders
- [x] Add `serveGameAssets()` Vite plugin to Dungeon Cake for dynamic tileset URL resolution
- [ ] Verify: initial load works, HMR reload works, all three autotile groups render correctly

# --- handoff point ---

## Phase 3: Sprite assigner save changes
- [x] Remove `generateAutotileSheets()` from `generate.ts`
- [x] Remove `rewriteAutotileForGame()` from `api.ts`
- [x] Update save endpoint: write new `autotile` format (per-group objects) + `sheets` section to `assignments.json`
- [x] Update `SavePayload` type: `autotile` becomes `Record<string, { sheet: string; format: string }>` instead of per-variant arrays
- [x] Update assignment state types in `assignments.ts` to match new autotile model
- [ ] Verify: Save to Disk writes correct assignments.json, game hot-reloads from it

## Phase 4: Sprite assigner autotile UI simplification
- [x] Replace `AutotilePanel` per-variant grid with per-group sheet+format assignment UI
- [x] Each connection group row: group name, sheet selector (from loaded sheets), format selector (grid/wang)
- [x] Remove per-variant click assignment workflow, `importWangBlob` action, Wang Blob import bar
- [x] Update assignment reducer: replace variant-level actions with group-level sheet assignment
- [ ] Verify: assign sheets to groups in UI, save, game loads correctly

# --- handoff point ---

## Phase 5: Cleanup and docs
- [x] Remove dead code: `wangBlobVariants()` fallback function if fully superseded, unused imports
  - No dead code found. `wangVariants()` is actively used for wang format. Fixed stale comment in autotile.ts.
- [x] Evaluate whether `sprite-manifest.json` generation path needs any updates
  - No changes needed — `generateMasterSheet()` still writes it correctly.
- [x] Update `docs/pixel-art/autotile/AUTOTILE.md` — data pipeline section, key files table
- [x] Update `docs/pixel-art/sprite-layer-pipeline.md` — key files table
- [x] Update `tools/sprite-assigner-v2/CONTEXT.md` — output file descriptions, autotile workflow
- [ ] End-to-end test: edit PNG in Aseprite → reload game → correct rendering (no assigner needed)
