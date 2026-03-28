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
- [ ] Remove `generateAutotileSheets()` from `generate.ts`
- [ ] Remove `rewriteAutotileForGame()` from `api.ts`
- [ ] Update save endpoint: write new `autotile` format (per-group objects) + `sheets` section to `assignments.json`
- [ ] Update `SavePayload` type: `autotile` becomes `Record<string, { sheet: string; format: string }>` instead of per-variant arrays
- [ ] Update assignment state types in `assignments.ts` to match new autotile model
- [ ] Verify: Save to Disk writes correct assignments.json, game hot-reloads from it

## Phase 4: Sprite assigner autotile UI simplification
- [ ] Replace `AutotilePanel` per-variant grid with per-group sheet+format assignment UI
- [ ] Each connection group row: group name, sheet selector (from loaded sheets), format selector (grid/wang)
- [ ] Remove per-variant click assignment workflow, `importWangBlob` action, Wang Blob import bar
- [ ] Update assignment reducer: replace variant-level actions with group-level sheet assignment
- [ ] Verify: assign sheets to groups in UI, save, game loads correctly

# --- handoff point ---

## Phase 5: Cleanup and docs
- [ ] Remove dead code: `wangBlobVariants()` fallback function if fully superseded, unused imports
- [ ] Evaluate whether `sprite-manifest.json` generation path needs any updates
- [ ] Update `docs/pixel-art/autotile/AUTOTILE.md` — data pipeline section, key files table
- [ ] Update `docs/pixel-art/sprite-layer-pipeline.md` — key files table
- [ ] Update `tools/sprite-assigner-v2/CONTEXT.md` — output file descriptions, autotile workflow
- [ ] End-to-end test: edit PNG in Aseprite → reload game → correct rendering (no assigner needed)
