# Sprite Loading Consolidation — Tasks

## Phase 1: Fix the immediate chasm sheet mismatch
- [ ] Change tileset-loader.ts chasm import from `raw-autotile/chasm-autotile-v3.png` to `autotile/chasm-autotile.png`
- [ ] Fix `AUTOTILE_SHEETS` key: `ChasmAutotileV3` → `ChasmAutotile` for consistency
- [ ] Verify chasm autotile renders correctly in-game

# --- handoff point ---

## Phase 2: Add `sheets` section to assignments.json
- [ ] Update `generate.ts` save output to include `sheets` object (master + all autotile sheets)
- [ ] Update `api.ts` `rewriteAutotileForGame` to set `tiletype` sheet keys to `"master"`
- [ ] Add `AssignmentsData.sheets` type to `glyph-sprite-map.ts`
- [ ] Write updated assignments.json from sprite assigner (Save to Disk) and verify format

## Phase 3: Make tileset-loader data-driven
- [ ] Remove static `import ... from '...png?url'` lines
- [ ] `loadTilesetImages()` takes a `sheets: Record<string, string>` param, builds URLs from it
- [ ] `reloadTilesetImages()` takes same param with cache-busting
- [ ] Update `bootstrap.ts` to read sheets from assignments.json and pass to loader
- [ ] Verify initial load + HMR reload both work

## Phase 4: Remove redundant config from glyph-sprite-map.ts
- [ ] Remove `AUTOTILE_SHEETS` constant
- [ ] Remove `SHEET_NAME_MAP` constant
- [ ] Remove `autotileVariants()` and `wangBlobVariants()` fallback functions
- [ ] Simplify `buildAutotileVariantMap()` — assignments.json is the only source, no fallback
- [ ] Remove `buildTileTypeSpriteMap()` if tiletype coordinates now come from assignments.json directly
- [ ] Evaluate whether `sprite-manifest.json` can be removed (resolve Open Question in PLAN.md)

# --- handoff point ---

## Phase 5: Docs and verification
- [ ] Update `docs/pixel-art/autotile/AUTOTILE.md` — data pipeline section, key files table
- [ ] Update `docs/pixel-art/sprite-layer-pipeline.md` — key files table
- [ ] Update `tools/sprite-assigner-v2/CONTEXT.md` — output file descriptions
- [ ] End-to-end test: sprite assigner Save → game hot-reload → correct rendering
