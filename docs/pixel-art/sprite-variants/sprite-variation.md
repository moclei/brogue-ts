# Context-Aware Sprite Variants

> **Status:** Draft — needs refinement before initiative creation
> **Date:** 2026-03-26
> **Parent:** `docs/pixel-art/pixel-art-exploration.md` (roadmap items 3, 4, and new)
> **Key references:**
> - `docs/pixel-art/autotile-variant-reference.md` — 47-variant blob autotile spec
> - `rogue-ts/src/platform/autotile.ts` — connection groups, adjacency mask computation
> - `rogue-ts/src/platform/glyph-sprite-map.ts` — AUTOTILE_SKIP, variant map construction
> - `rogue-ts/src/io/sprite-appearance.ts` — getCellSpriteData (where layers are built)
> - `rogue-ts/src/platform/sprite-renderer.ts` — drawCellLayers (where variants are selected)

---

## Overview

Three related features that all solve the same problem: the sprite pipeline currently
picks one sprite per TileType, but many tiles would look better with context-sensitive
sprite selection. Each feature addresses a different kind of "context":

1. **Simplified autotiling** — neighbor topology (bridges, catwalks)
2. **Orientation detection** — wall-run direction (doors)
3. **Random variation** — cosmetic diversity (grass, debris, cobwebs)

These features share infrastructure (the sprite manifest, the renderer's variant lookup,
the `getCellSpriteData` layer-building pipeline) and can be developed as phases of a
single initiative.

---

## Feature 1: Simplified Autotiling (Bridges)

### Problem

Bridge tiles (`BRIDGE`, `STONE_BRIDGE`, `BRIDGE_EDGE`) currently render as a single
static sprite regardless of orientation. A bridge spanning a chasm east-to-west looks
identical to one spanning north-to-south. Real bridges have a clear directional shape —
planks run perpendicular to the span, railings run parallel.

### Current State

- Bridge TileTypes are **not in any connection group** — `getConnectionGroupInfo(TileType.BRIDGE)` returns `undefined`
- The autotile system computes adjacency masks only for grouped types (WALL, WATER, LAVA, CHASM, FLOOR, ICE, MUD)
- Bridges have single-sprite entries in `assignments.json`

### Proposed Approach

Create a `BRIDGE` connection group containing bridge-related TileTypes. Use the existing
47-variant autotile infrastructure, but only provide sprites for the variants that
bridges actually need. The renderer already falls back gracefully when a variant map
entry is a placeholder (same sprite for all variants).

**Connection group definition:**
```typescript
{
    group: "BRIDGE",
    dungeonLayer: DungeonLayer.Dungeon,
    oobConnects: false,
    tileTypes: [
        TileType.BRIDGE,
        TileType.BRIDGE_EDGE,
        TileType.STONE_BRIDGE,
    ],
}
```

**Which variants matter for bridges?**

Bridges only need a handful of the 47 variants. The useful ones:

| Variant | Cardinals | Visual meaning |
|---------|-----------|----------------|
| 0 | — | Isolated (single bridge tile, no neighbors) |
| 1 | N | End piece (bridge extends north) |
| 2 | E | End piece (bridge extends east) |
| 5 | S | End piece (bridge extends south) |
| 6 | N+S | Vertical span |
| 13 | W | End piece (bridge extends west) |
| 15 | E+W | Horizontal span |
| 8 | N+E+S | T-junction (no west) |
| 19 | N+S+W | T-junction (no east) |
| 16 | N+E+W | T-junction (no south) |
| 20 | E+S+W | T-junction (no north) |
| 21 | N+E+S+W | Crossroads |

That's ~12 variants out of 47. Corner variants are irrelevant for bridges (diagonal
bridge connections don't exist in practice).

**What counts as "connected" for a bridge?** Other bridge tiles. Not the chasm/water
underneath, not the land on either side. The connection group only contains bridge types.

### Open Questions

- Should `BRIDGE_FALLING` be in the group? It's a transient state during bridge collapse.
- Should `CHASM_WITH_HIDDEN_BRIDGE_ACTIVE` connect? When activated, it visually becomes
  a bridge — but its TileType is different.
- Do we need distinct sprites for `BRIDGE` vs `STONE_BRIDGE`, or can they share one
  autotile sheet? In the C game they have different visual styles.
- Are catwalks (`DF_CATWALK_BRIDGE`) a separate connection group or part of BRIDGE?

### What This Reuses

- `computeAdjacencyMask()` — unchanged
- `buildAutotileVariantMap()` — unchanged (just needs a new entry in `AUTOTILE_SHEETS`)
- `SpriteRenderer.drawCellLayers()` variant lookup — unchanged
- `getCellSpriteData` adjacency mask emission — unchanged
- Spritesheet format — same 8×6 grid, 128×96px at 16×16

### What's New

- Connection group definition in `autotile.ts`
- `AUTOTILE_SHEETS` entry in `glyph-sprite-map.ts`
- Bridge autotile spritesheet(s) in `rogue-ts/assets/tilesets/autotile/`
- Sprite assigner support for authoring the bridge sheet

---

## Feature 2: Orientation Detection (Doors)

### Problem

Door tiles (`DOOR`, `OPEN_DOOR`, `LOCKED_DOOR`) always render with the same sprite
regardless of whether the door is set into a horizontal wall run (east-west corridor)
or a vertical wall run (north-south corridor). A door in a horizontal wall should show
a vertically-oriented door frame; a door in a vertical wall should show a horizontally-
oriented one.

### Current State

- Door TileTypes are in the `WALL` connection group but listed in `AUTOTILE_SKIP` —
  they participate in wall adjacency calculations (so neighboring walls see them as
  connected) but keep their own single sprite
- No orientation field exists on cells or in the sprite data
- `getCellSpriteData` does not compute door orientation

### Proposed Approach

Compute door orientation at draw time from wall neighbors, similar to how autotiling
works. A door with walls to its N and S (vertical wall run) is a **horizontal door**
(the door opens along the E-W axis). A door with walls to its E and W (horizontal wall
run) is a **vertical door**.

**Detection logic (in `getCellSpriteData` or a helper):**

```typescript
function getDoorOrientation(x: number, y: number, pmap: Pcell[][]): "horizontal" | "vertical" {
    const wallGroup = getConnectionGroupInfo(TileType.WALL);
    if (!wallGroup) return "vertical"; // fallback

    const hasWallN = coordinatesAreInMap(x, y - 1)
        && wallGroup.members.has(pmap[x][y - 1].layers[DungeonLayer.Dungeon]);
    const hasWallS = coordinatesAreInMap(x, y + 1)
        && wallGroup.members.has(pmap[x][y + 1].layers[DungeonLayer.Dungeon]);
    const hasWallE = coordinatesAreInMap(x + 1, y)
        && wallGroup.members.has(pmap[x + 1][y].layers[DungeonLayer.Dungeon]);
    const hasWallW = coordinatesAreInMap(x - 1, y)
        && wallGroup.members.has(pmap[x - 1][y].layers[DungeonLayer.Dungeon]);

    // Walls above and below → door is horizontal (opens east-west)
    if (hasWallN && hasWallS) return "horizontal";
    // Walls left and right → door is vertical (opens north-south)
    if (hasWallE && hasWallW) return "vertical";
    // Ambiguous — default
    return "vertical";
}
```

**Sprite selection:** Two approaches:

1. **Separate TileType sprites in the manifest** — add orientation-suffixed entries
   (e.g., `DOOR_H` and `DOOR_V` as sprite keys, not new TileTypes). The renderer
   picks the right key based on computed orientation.

2. **Canvas rotation** — use `ctx.rotate(Math.PI / 2)` to rotate a single door sprite.
   Simpler but pixel art often doesn't rotate well at 90°.

3. **Two-variant autotile** — treat it like a minimal autotile with just 2 variants
   (horizontal and vertical). Could reuse the variant map infrastructure with a custom
   mapping.

### Open Questions

- Which approach for sprite selection? Separate manifest entries feels cleanest.
- Does this apply to portcullises too? They're also in `AUTOTILE_SKIP` and wall-embedded.
- Should `OPEN_DOOR` get the same orientation detection? An open door sprite might need
  to show which direction it swung open.
- How does the sprite assigner handle orientation variants? New UI section, or just
  two entries per door type in the assignments panel?

### What This Reuses

- Wall connection group membership data (for neighbor checks)
- `coordinatesAreInMap` bounds checking

### What's New

- Orientation detection function
- Extended sprite lookup in the renderer (TileType + orientation → sprite)
- Manifest format extension (orientation-keyed entries) or rotation logic
- Sprite assigner UI for door orientation variants

---

## Feature 3: Random Variation (Grass, Debris)

### Problem

Decorative tiles like grass, cobwebs, and debris use a single sprite per TileType.
When these tiles cover large areas (grass across a meadow, bloodstains after combat),
the repetition is visually obvious and unappealing. Natural-looking terrain needs
variety — slightly different grass shapes, different debris orientations, varied cobweb
patterns.

### Current State

- Each TileType maps to exactly one `SpriteRef` in the sprite manifest
- `terrainRandomValues` exists per cell (8 random numbers per cell, initialized at
  level start) but is only used for **color jitter** via `bakeTerrainColors` — not
  for sprite selection
- The autotile variant map allows multiple sprites per TileType (47-element arrays) but
  is driven by neighbor topology, not randomness
- No mechanism exists for "pick one of N sprites randomly"

### Proposed Approach

Extend the sprite manifest to allow **multiple sprites per TileType** for designated
"variation" types. At render time, use the existing `terrainRandomValues` to
deterministically select a variant.

**Manifest format extension:**

Currently `assignments.json` maps `TileType → {x, y, sheet}`. For variation types, it
would map `TileType → [{x, y, sheet}, {x, y, sheet}, ...]` (an array of sprite refs).

**Variant selection:**

```typescript
// In SpriteRenderer, when looking up a TileType sprite:
const variants = variationMap.get(tileType);
if (variants && variants.length > 1) {
    const terrainVal = terrainRandomValues[x]?.[y]?.[0] ?? 0;
    const idx = terrainVal % variants.length;
    spriteRef = variants[idx];
}
```

This gives each cell a stable, deterministic variant (same variant every frame for a
given cell, changes only on level regeneration). The randomness comes from the
already-allocated `terrainRandomValues`.

**Which TileTypes benefit from variation?**

| TileType | Why |
|----------|-----|
| `GRASS` | Largest visual impact — grass covers meadows |
| `DEAD_GRASS` | Same as grass |
| `FOLIAGE` | Forest areas with repeating trees |
| `FUNGUS_FOREST` | Underground mushroom forests |
| `BLOODFLOWER_STALK`, `BLOODFLOWER_POD` | Decorative variety |
| `BONES` | Scattered bones should look varied |
| `RUBBLE` | Debris piles |
| `COBWEB` | Web patterns |
| `HAY` | Hay bales / strewn hay |
| `LICHEN` | Wall decoration |

### Open Questions

- How does this interact with autotiling? A tile can't have both autotile variants (47
  neighbor-based) and random variation. Or can it? Could each autotile variant have
  sub-variants? That's exponential art cost.
- How many variants per type is practical? 2-4 seems like the sweet spot — enough
  variety to break repetition, not so many that art cost explodes.
- Should the sprite assigner UI support this? Probably yes — a "Variation" section
  where you assign multiple sprites to a TileType.
- Could canvas transforms (horizontal flip, small rotation) provide free variation
  without extra art? Pixel art flips well horizontally. A grass sprite and its mirror
  image already look like two different grass sprites.
- Does the `terrainRandomValues` selection need to be visually validated? The values
  range 0-999, so `% 3` for a 3-variant type gives indices 0, 1, 2 with near-uniform
  distribution. Should be fine.

### What This Reuses

- `terrainRandomValues` (already allocated and per-cell)
- `SpriteRef` type and sprite rendering infrastructure

### What's New

- Manifest format extension for multi-sprite entries
- Variation map construction from manifest
- Renderer variant selection logic
- Sprite assigner "Variation" UI section

---

## Implementation Phases

If developed as a single initiative:

### Phase 1: Simplified Autotiling (Bridges)

- Define BRIDGE connection group in `autotile.ts`
- Add `AUTOTILE_SHEETS` entry in `glyph-sprite-map.ts`
- Create placeholder bridge autotile sheet (same sprite repeated, or debug numbered)
- Verify adjacency masks compute correctly for bridge layouts
- Test in Dungeon Cake (generate deep levels with bridges)

### Phase 2: Door Orientation

- Add orientation detection function
- Extend sprite lookup to consider orientation
- Update manifest format for orientation variants
- Create placeholder horizontal/vertical door sprites
- Test in Dungeon Cake

### Phase 3: Random Variation

- Extend manifest format for multi-sprite entries
- Build variation map from manifest in tileset loading
- Add variant selection logic to renderer
- Update sprite assigner with variation UI
- Create 2-3 grass variants as proof of concept
- Test in Dungeon Cake with grass-heavy levels (depth 1-5)

---

## Relationship to Existing Initiatives

| Initiative | Relationship |
|------------|-------------|
| 3 (Autotiling System) | Complete — this builds on the infrastructure it established |
| 8 (Art Pipeline) | Art creation for bridge/door/variation sprites. Could produce the sprites this initiative consumes |
| 10 (Dev Tools) | Dungeon Cake used for testing all three features |

---

## Risks

- **Art burden.** Even simplified, bridges need ~12 sprites per bridge type, doors need
  2 per door type, and grass needs 2-4 per plant type. Without an artist, these would
  need to be sourced from DawnLike or created as debug placeholders.
- **Manifest format change.** Extending `assignments.json` to support arrays requires
  updating the sprite assigner's read/write logic and the game's manifest parser.
- **Interaction with future liquid layer promotion.** If `RenderLayer.LIQUID` is added
  (Initiative 9), bridge rendering might interact with liquid/chasm layers in ways that
  need testing.
