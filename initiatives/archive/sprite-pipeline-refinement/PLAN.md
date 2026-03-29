# Sprite Pipeline Refinement — Plan

## Approach

Four phases, each independently committable:

1. **Disable multiply tinting** — remove ASCII-inherited per-layer color
   multiplication; sprites draw with original PNG colors. Document remaining
   shared ASCII dependencies.
2. **LIQUID layer** — insert a new render layer between TERRAIN and SURFACE
   for liquids, eliminating the liquid-vs-decoration priority contest.
3. **Debug panel expansion** — add a per-layer "deep dive" screen with
   Canvas2D filter, shadow, and transform controls for art exploration.
4. **Master spritesheet** — consolidate all sprites into one packed PNG with
   a JSON manifest; simplify the loader and sprite map.

---

## Phase 1: Disable Multiply Tinting

### What changes

In `drawCellLayers()` (`sprite-renderer.ts`), the TERRAIN layer already
skips tinting via `TERRAIN_NO_TINT` (blend mode `"none"`). Phase 1 extends
this to all layers 0–5 (TERRAIN, SURFACE, ITEM, ENTITY, GAS, FIRE).

The `drawSpriteTinted()` call for each layer will use blend mode `"none"` by
default — the sprite is drawn directly to the canvas without the offscreen
multiply pass. The full tinting path is preserved and still activatable via
the F2 debug panel's per-layer tint override (for experimentation), but the
automatic `foreColor`/`backColor` tinting from the tile catalog is bypassed.

### VISIBILITY layer — unchanged

Layer 6 (VISIBILITY) continues to draw a full-cell multiply fill from
`lightMultiplierColor`. This is the dungeon lighting system and is
intentionally shared with ASCII. It works correctly on sprites because it
darkens/tints the entire cell uniformly, rather than trying to color-shift
individual sprite pixels.

### bakeTerrainColors

Currently called in `getCellSpriteData()` for TERRAIN tint + bgColor, and
for SURFACE tint. With multiply tinting disabled, baked tint values have no
visual effect. Options:

- **(A) Keep the calls, ignore the results.** `bakeTerrainColors` also
  propagates the `colorDances` flag (used to trigger per-frame re-renders for
  shimmer). Keeping the calls preserves this behavior.
- **(B) Remove the calls, relocate colorDances detection.** Cleaner, but
  requires extracting the `colorDances` check into a separate function.

Recommendation: **(A)** for Phase 1. The calls are cheap (two Color
mutations, no allocations) and preserving `colorDances` avoids a secondary
refactor. If we later redesign shimmer for sprites (e.g., sprite-native
animation instead of color-dancing), we remove the calls then.

### Tint data still computed

`getCellSpriteData()` still copies `foreColor`/`backColor` into
`LayerEntry.tint` because:
- The F2 debug panel displays actual tint values on cell inspection
- The debug panel's per-layer tint override still works (you can re-enable
  tinting on any layer to experiment)
- `colorDances` detection reads the tint's `colorDances` flag

The tint data is computed but not drawn unless explicitly overridden.

### Files touched

| File | Change |
|------|--------|
| `sprite-renderer.ts` | Extend `TERRAIN_NO_TINT` skip to layers 0–5 in `drawCellLayers()`. The `skipTint` condition changes from `i === RenderLayer.TERRAIN` to `i !== RenderLayer.VISIBILITY`. |
| `sprite-layer-pipeline.md` | Update tint descriptions; mark multiply tinting as disabled; update shared ASCII infrastructure section. |

### Testing

- Existing tests pass unchanged (tint data is still computed, just not drawn)
- Manual browser verification: sprites should appear with original PNG colors;
  VISIBILITY lighting overlay still darkens/tints cells

---

## Phase 2: LIQUID Layer

### Layer renumbering

Insert `LIQUID = 1` into `RenderLayer`. All subsequent layers shift up by 1:

| Old | New | Name |
|-----|-----|------|
| 0 | 0 | TERRAIN |
| — | **1** | **LIQUID** |
| 1 | 2 | SURFACE |
| 2 | 3 | ITEM |
| 3 | 4 | ENTITY |
| 4 | 5 | GAS |
| 5 | 6 | FIRE |
| 6 | 7 | VISIBILITY |
| 7 | 8 | STATUS |
| 8 | 9 | BOLT |
| 9 | 10 | UI |

`RENDER_LAYER_COUNT` increases from 10 to 11.

### Routing change in getCellSpriteData

Currently, `DungeonLayer.Liquid` tiles are routed to `RenderLayer.SURFACE`.
Phase 2 routes them to `RenderLayer.LIQUID` instead. The `drawPriority`
contest between liquids and surface decorations is eliminated — both always
draw (liquid underneath, decoration on top).

`DungeonLayer.Surface` tiles continue to route to `RenderLayer.SURFACE`
(now index 2).

### Autotiling

`computeAdjacencyMask()` calls for liquid tiles move to the LIQUID layer
entry. No change to the bitmask algorithm itself.

### Shallow liquid alpha

The `isShallowLiquid()` alpha (0.55) moves to LIQUID layer. SURFACE layer
no longer needs the shallow-liquid alpha path.

### Files touched

| File | Change |
|------|--------|
| `render-layers.ts` | Add `LIQUID = 1`, renumber enum, bump `RENDER_LAYER_COUNT` to 11 |
| `sprite-appearance.ts` | Route `DungeonLayer.Liquid` → `RenderLayer.LIQUID`; remove `drawPriority` contest |
| `sprite-renderer.ts` | No structural changes needed (generic layer loop). Update `skipTint` range if layer indices changed. |
| `sprite-debug.ts` | Add "LIQUID" to `LAYER_NAMES` array |
| `autotile.ts` | No changes (bitmask computation is layer-agnostic) |
| Tests | Update any hardcoded layer indices |
| `sprite-layer-pipeline.md` | Add Layer 1: LIQUID section, renumber subsequent layers |

### Testing

- All existing tests updated for new indices and passing
- New test: cell with both liquid and surface decoration has both layers
  populated (previously only one could win)
- Manual browser verification: shallow water + foliage renders correctly

---

## Phase 3: Debug Panel Expansion

### Per-layer deep-dive screen

The current F2 panel shows a compact row per layer. Phase 3 adds a "deep
dive" mode: clicking a layer name opens an expanded view for that layer with
additional Canvas2D parameters. A "Back" button returns to the overview.

### New parameters

| Parameter | Canvas2D API | Control type | Use case |
|-----------|-------------|-------------|----------|
| Filter | `ctx.filter` | Text input (CSS filter string) | `blur(1px)`, `brightness(1.5)`, `saturate(2)`, `hue-rotate(90deg)` |
| Shadow blur | `ctx.shadowBlur` | Slider (0–20) | Glow effects on fire, magic, crystals |
| Shadow color | `ctx.shadowColor` | Color picker | Glow color |
| Shadow offset X/Y | `ctx.shadowOffsetX/Y` | Sliders (-10 to 10) | Directional glow |
| Image smoothing | `ctx.imageSmoothingEnabled` | Checkbox | Pixel-perfect vs anti-aliased |
| Horizontal flip | `ctx.scale(-1, 1)` | Checkbox | Mirror sprites |
| Rotation | `ctx.rotate()` | Slider (0–360°) | Organic variety |
| Scale | `ctx.scale()` | Slider (0.5–2.0) | Size adjustment |

### Implementation

The `LayerOverride` interface in `sprite-debug.ts` gains new optional fields
for each parameter. `drawSpriteTinted()` in `sprite-renderer.ts` reads them
and applies `ctx.save() → transform/filter/shadow → draw → ctx.restore()`.

The deep-dive UI is a separate DOM panel that replaces the layer list when
active. State is stored on the existing `LayerOverride` objects — switching
between overview and deep-dive is purely a DOM toggle.

### File size management

`sprite-debug.ts` is currently 492 lines. The deep-dive UI will add
~150–200 lines. If it exceeds 550, extract the deep-dive panel builder into
`sprite-debug-detail.ts` (per the 600-line rule).

---

## Phase 4: Master Spritesheet Pipeline

### Architecture

```
sprite-assigner tool
        │
        ├── writes: master-spritesheet.png (packed 16×16 tiles)
        └── writes: sprite-manifest.json  (TileType/Glyph → {x, y} coords)

tileset-loader.ts
        │
        └── imports: master-spritesheet.png (single image)

glyph-sprite-map.ts
        │
        └── reads: sprite-manifest.json → builds spriteMap + tileTypeSpriteMap
```

### Master spritesheet layout

One 16×16 cell per TileType and DisplayGlyph. ~348 slots → 24×15 grid
(360 cells, 12 unused) → 384×240 pixels. Autotile variant sheets remain
separate (47 sprites per connectable tile type, different concern).

### Manifest format

```json
{
  "tileSize": 16,
  "gridWidth": 24,
  "tiles": {
    "GRANITE": { "x": 0, "y": 0 },
    "WALL":    { "x": 1, "y": 0 },
    "FLOOR":   { "x": 2, "y": 0 }
  },
  "glyphs": {
    "G_PLAYER": { "x": 0, "y": 10 },
    "G_POTION": { "x": 1, "y": 10 }
  }
}
```

### Sprite-assigner tool changes

The existing sprite-assigner web tool gains a "Save to master sheet" button.
When the user assigns a sprite (from a source sheet) to a TileType or Glyph,
the tool copies the 16×16 region into the master sheet at the assigned slot.
On save, it writes both the PNG and the JSON manifest.

### Loader simplification

`tileset-loader.ts` changes from importing ~10 individual sheets to importing
one `master-spritesheet.png`. The `SHEET_URLS` map reduces to a single entry.

`glyph-sprite-map.ts` changes from hardcoded coordinate mappings per source
sheet to reading the manifest JSON. The `buildSpriteMap()` and
`buildTileTypeSpriteMap()` functions become simple loops over manifest entries.

### Files touched

| File | Change |
|------|--------|
| `tileset-loader.ts` | Import single master sheet; remove individual sheet imports |
| `glyph-sprite-map.ts` | Read manifest JSON; replace hardcoded coordinate lookups |
| Sprite-assigner tool | Add master sheet packing + manifest export |
| `sprite-layer-pipeline.md` | Update Key Files section |

### Testing

- Existing sprite resolution tests updated to use manifest-based coordinates
- Manual verification: all sprites render correctly from the master sheet

---

## Open Questions

- **colorDances long-term:** Once per-layer tinting is disabled, colorDances
  only affects frame re-render scheduling (the actual color shimmer is
  invisible). Should we implement sprite-native shimmer (e.g., palette cycling
  or subtle animation) as a replacement? Deferred to Initiative 7 (Animation).
- **Filter performance:** CSS filter strings on Canvas2D may be expensive for
  per-cell application. Phase 3 should include a performance check. If
  filters are too slow per-cell, restrict them to debug-only (not for
  production rendering).
- **Master sheet and hot-reload:** During art development, artists will want
  to update individual sprites without regenerating the whole master sheet.
  The sprite-assigner tool should support incremental updates (replace one
  slot, re-export). Details to be worked out in Phase 4.
