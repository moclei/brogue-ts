# Pixel Art Variable Resolution — Tasks

## Phase 1: Data Contract

_Extend types and data-flow functions on both the game side and assigner side.
No behavior changes yet — just the type contracts and their tests. Each side
can be verified independently before Phase 2 and 3 begin._

- [x] **Game side — types and map builders** (`glyph-sprite-map.ts`)
  - Add optional `srcW?: number` / `srcH?: number` to `SpriteRef`
  - Extend `SpriteManifest` glyph entry type: `{ x, y, w?, h?, sheet? }`
  - Change `AssignmentsData.sheets` from `{ master: string }` to
    `Record<string, string>`
  - Update `buildGlyphSpriteMap`: read `w`/`h`/`sheet` from manifest entry;
    populate `srcW = w ?? TILE_SIZE`, `srcH = h ?? TILE_SIZE`,
    `sheetKey = sheet ?? MASTER_SHEET_KEY` on `SpriteRef`
  - Update `buildSheetUrls`: iterate all `sheets` entries (not just `master`)
  - Update `glyph-sprite-map.test.ts`: test backward compat (no `w`/`h` →
    defaults), test extended manifest entry round-trip, test multi-sheet URL map

- [x] **Assigner side — types and state** (`sheet-manifest.ts`, `assignments.ts`)
  - Add optional `stride?: number` field to `SheetEntry` type in `sheet-manifest.ts`
    (no `stride` → inherits manifest-level `tileSize: 16`)
  - Extend glyph assignment type in `assignments.ts` from `{ sheet, x, y }` to
    `{ sheet, x, y, w?: number, h?: number }` (w/h in tile units; default 1×1)
  - Add migration in the assignments reducer `loadFromManifest` (and localStorage
    read) to tolerate missing `w`/`h` on stored glyph entries
  - Add `stride` input (optional, placeholder "16") to the Add Sheet dialog in
    `SheetManager.tsx`

# --- handoff point ---

## Phase 2: Game Renderer

_Make the renderer use per-ref source dimensions. All hardcoded `TILE_SIZE`
references inside the draw path are replaced with per-ref values._

- [x] **`tileset-loader.ts` and `sprite-renderer.ts` — dimension-aware rendering**
  - Add `export const MAX_SPRITE_SIZE = 64` to `tileset-loader.ts`
  - Add a doc comment on `TILE_SIZE`: "default stride for standard tiles and
    for glyphs without explicit dimensions"
  - In `SpriteRenderer` constructor: change `tintCanvas` to
    `new OffscreenCanvas(MAX_SPRITE_SIZE, MAX_SPRITE_SIZE)`
  - In `drawSpriteTinted`: replace all uses of `TILE_SIZE` for source rect math
    with `srcW = spriteRef.srcW ?? TILE_SIZE` and `srcH = spriteRef.srcH ?? TILE_SIZE`;
    use `srcW`/`srcH` for `clearRect`, both `drawImage` calls, and `fillRect`
    on the tint canvas
  - In `precreateBitmaps`: use per-ref `srcW`/`srcH` for the `createImageBitmap`
    source rect dimensions
  - Update `bitmapKey`: append `:WxH` suffix when `srcW !== TILE_SIZE || srcH !== TILE_SIZE`

- [x] **Renderer unit tests**
  - In `glyph-sprite-map.test.ts` or a new `sprite-renderer.test.ts`:
    confirm that a `SpriteRef` with `srcW=32, srcH=32` causes `createImageBitmap`
    to be called with 32×32 source dimensions (mock `createImageBitmap`)
  - Confirm standard refs (no `srcW`/`srcH`) still use `TILE_SIZE` dimensions
  - Confirm `bitmapKey` produces different strings for 16×16 vs 32×32 refs at
    the same `(sheetKey, tileX, tileY)` coordinates

# --- handoff point ---

## Phase 3: Assigner Backend

_`generate.ts` branches by output pixel size, writing one atlas per stride.
`assignments.json` gains hires sheet entries. Round-trip with the game verified._

- [x] **`generate.ts` — per-stride atlas generation**
  - Add `resolveOutputSize(glyphAssignment, sourceSheetStride): number` helper
    that returns `w * stride` (defaults: w=1, stride from sheet entry)
  - Group glyph assignments by output pixel size; 16px group uses existing
    master sheet path unchanged
  - For each non-16px group (e.g. 32px, 64px):
    - Determine a grid layout (row-major, fixed width; expand height as needed)
    - Extract source rects using `(x * sourceStride, y * sourceStride,
      w * sourceStride, h * sourceStride)` from the source sheet image via `sharp`
    - Composite into an output buffer at the target stride per cell
    - Write to `rogue-ts/assets/tilesets/master-{outputSize}.png`
    - Write manifest entries: `{ x: col, y: row, w: outputSize, h: outputSize,
      sheet: "master-{outputSize}" }`
  - Update `assignments.json` `sheets` record: add `"master-{outputSize}":
    "master-{outputSize}.png"` for each generated atlas

- [x] **`api.ts` — save payload and validation**
  - Accept `w`/`h` on glyph assignment objects in the `POST /api/save` payload
  - Validate: `w` and `h` must be positive integers if present
  - Return new `sheets` entries in the save response alongside existing fields
  - Verify end-to-end: assign one glyph with `w=2, h=2` on a 16px sheet in the
    assigner → Save to Disk → confirm `master-32.png` exists, `assignments.json`
    `sheets` includes `master-32`, manifest entry has correct `w`/`h`/`sheet`

# --- handoff point ---

## Phase 4: Assigner UI

_Stride-aware grid display, rect selection for glyph mode, hires thumbnails._

- [x] **`GridCanvas` — stride-aware grid and rect selection**
  - Look up the active sheet's `stride` from the loaded sheet registry
    (default 16 if not declared); store as `sheetStride` in component state
  - Draw grid lines at `sheetStride * zoom` pixel intervals (not hardcoded 16)
  - Convert mouse coordinates to tile: `tileX = floor(mouseX / (sheetStride * zoom))`
  - For **DisplayGlyph** tab: implement click-drag rect selection
    - Track `mousedown` → start position in tile coords
    - Track `mousemove` → compute `{ tileX, tileY, w, h }` from drag delta
    - Track `mouseup` → commit selection; dispatch to `AppState`
    - Draw selection rect spanning `w * sheetStride * zoom` × `h * sheetStride * zoom`
    - Draw existing assignment markers at their correct tile span
  - For **TileType** tab: selection remains 1×1 tile (terrain stays 16×16)

- [x] **`SelectionBar` and `EnumEntry` — dimension display and hires thumbnails**
  - `SelectionBar`: show tile dimensions of current selection alongside pixel
    size, e.g. "2×2 tiles (32 px)" or "1×1 tile (64 px)"
  - `EnumEntry` (glyph tab only): render thumbnail from full source rect
    `(tileX * stride, tileY * stride, w * stride, h * stride)` instead of
    fixed `(tileX * 16, tileY * 16, 16, 16)`; scale down to thumbnail canvas size

- [x] **`ExportModal` — import/export with `w`/`h`** _(no changes needed — Phase 1 migration covers round-trip)_
  - Export JSON: include `w`/`h` on glyph entries when present
  - Import JSON: accept glyph entries with or without `w`/`h`; missing fields
    default to 1×1 (migration)
  - Verify: export a set of assignments with a hires glyph → reimport →
    confirm `w`/`h` preserved and assignment displays correctly

# --- handoff point ---

## Phase 5: Integration

_Verify the full pipeline end-to-end. Confirm HMR works with multiple atlases._

- [x] **HMR and bootstrap verification** _(no gaps — buildSheetUrls, loadTilesetImages, and bootstrap HMR handler all correct)_
  - Confirm `buildSheetUrls` (updated in Phase 1) returns all `sheets` entries
    including hires keys, so `loadTilesetImages` loads them without further changes
  - Confirm the bootstrap HMR handler (which calls `buildSheetUrls(newAssignments)`)
    correctly reloads hires atlases after an assigner save
  - If any gap is found, patch `bootstrap.ts` and add a note to PLAN.md

- [ ] **End-to-end developer smoke test** _(manual — requires running assigner + game; deferred to user)_
  - In the assigner: register a 32px-stride source sheet (or select a 2×2 region
    from a 16px sheet) and assign it to G_RAT in DisplayGlyph mode
  - Save to Disk; verify: `master-32.png` written, `assignments.json` updated,
    `sprite-manifest.json` glyph entry has `w: 32, h: 32, sheet: "master-32"`
  - Run the game; verify G_RAT renders from a 32×32 source at the correct position
    in the dungeon cell; verify all other sprites unaffected
  - Trigger an HMR reload by making a second assignment change and saving;
    verify the game updates without a page reload

- [x] **Documentation**
  - Update `docs/pixel-art/VARIABLE-RES.md`: mark all open decisions as resolved,
    describe final data shapes (manifest, assignments.json, SpriteRef), update
    file touch-points table to show actual changed files with one-line description
    of the change

# --- handoff point ---

## Phase 6: Manual Testing

_User-driven sign-off. Test each feature, report findings. Each item below is
checked off once the feature passes (after any bugs found are fixed)._

**Setup:** start the assigner (`npm run dev` in `tools/sprite-assigner-v2/`) and
the game dev server (`npm run dev` in `rogue-ts/`). Use the dungeon level to see
creature sprites in the dungeon cell.

- [ ] **Stride-aware grid** — register a source sheet with a `stride` other than
  16 (e.g. 32 or 64) and confirm grid lines in `GridCanvas` align to that stride
  with no misalignment at any zoom level

- [ ] **Rect selection — glyph mode** — on a 16px sheet, click-drag a 2×2 region
  in DisplayGlyph mode; confirm `SelectionBar` shows "2×2 tiles (32 px)" and the
  selection rect highlights the correct source region

- [ ] **Hires glyph assignment (32px)** — assign a 32×32 sprite to G_RAT;
  Save to Disk; confirm `master-32.png` exists in `rogue-ts/assets/tilesets/`
  and the game renders a rat with the correct sprite (not a 16×16 clip)

- [ ] **Hires glyph assignment (64px)** — assign a 64×64 sprite to another
  creature glyph (e.g. G_DRAGON); Save to Disk; confirm `master-64.png` exists
  and the game renders the sprite correctly at full resolution in the cell

- [ ] **Standard sprites unaffected** — after saving hires assignments, verify
  that all 16×16 terrain tiles, items, and unmodified creature glyphs still render
  correctly; no sprite corruption

- [ ] **HMR live reload** — with the game running, make a change to a hires glyph
  assignment in the assigner and Save; confirm the game sprite updates in-place
  without a full page reload and without corrupting other sprites

- [ ] **EnumEntry hires thumbnail** — confirm that a glyph with a 32×32 or 64×64
  assignment shows the correct sprite region in the enum list thumbnail (not a
  clipped 16×16 corner)

- [ ] **Export/import round-trip** — export assignments to JSON while a hires glyph
  is assigned; clear all assignments; reimport the JSON; confirm the hires glyph
  entry is restored with correct `w`/`h` and renders correctly after a Save

- [ ] **Backward compatibility** — open the assigner with an `assignments.json`
  that contains no `w`/`h` fields (the current file); confirm all existing
  assignments load and display correctly with no errors

## Deferred

_(none at initiative creation)_
