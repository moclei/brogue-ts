# Item Sprite Distinction

> **Status:** Draft — early exploration, needs refinement
> **Date:** 2026-03-26
> **Parent:** `docs/pixel-art/pixel-art-exploration.md`
> **Key references:**
> - `rogue-ts/src/io/sprite-appearance.ts` — getCellSpriteData ITEM layer (lines 459-489)
> - `rogue-ts/src/items/item-naming.ts` — shuffleFlavors, potion/wand appearance system
> - `rogue-ts/src/items/item-generation.ts` — makeItemInto, initializeItem
> - `rogue-ts/src/globals/string-tables.ts` — itemColorsRef (potion color names)
> - `rogue-ts/src/types/types.ts` — Item type, ItemTable
> - `rogue-ts/assets/tilesets/assignments.json` — current sprite assignments
> - `tools/sprite-assigner-v2/CONTEXT.md` — sprite assigner architecture

---

## Problem

The game has rich item variety that the sprite system doesn't express. Brogue describes
unidentified potions as "pink", "puce", "turquoise", etc. Weapons can be axes, swords,
maces, rapiers. Armor types include leather, chain mail, plate mail. Wands have
materials like "iron", "bone", "jade". But the sprite pipeline maps items by
`DisplayGlyph` only — all potions get the same potion sprite, all weapons get the same
weapon sprite, regardless of their specific kind or flavor.

This is a significant missed opportunity. Even without original pixel art, the DawnLike
tileset (and other tilesets) include multiple potion colors, multiple weapon types,
multiple armor styles. The sprites exist — the mapping system just doesn't know how to
select them.

---

## Current Architecture

### How items are rendered (sprite path)

In `getCellSpriteData` (ITEM layer block, lines 459-489):

```
if (item) {
    entry.glyph = item.displayChar;      // DisplayGlyph (e.g., G_POTION)
    entry.tint = item.foreColor ?? white; // single foreColor for all potions
}
```

The renderer then looks up `item.displayChar` (a `DisplayGlyph` enum) in the sprite
map. All potions share `G_POTION`, all weapons share `G_WEAPON`, etc.

### How item identity works

Items have several identity fields:

| Field | What it is | Example |
|-------|-----------|---------|
| `category` | Broad type (bitmask) | `POTION`, `WEAPON`, `ARMOR`, `WAND` |
| `kind` | Subtype index within category | Potion of strength = kind 0, of life = kind 1, etc. |
| `displayChar` | Glyph for rendering | `G_POTION` for all potions |
| `foreColor` | Tint color | `itemColor` (same for all items) |
| `flavor` | Unidentified descriptor | "pink", "puce", "turquoise" (potions) |
| `identified` | Whether the player knows what it is | boolean |

### How flavors/colors work

At game start, `shuffleFlavors()` (in `item-naming.ts`) randomizes the mapping between
potion kinds and color names. Each run, "potion of strength" might be "pink" or
"turquoise" or "puce" — the player doesn't know which until they identify it.

The color names come from `itemColorsRef` in `string-tables.ts`. These are strings
("pink", "turquoise", "puce") used for item descriptions, not RGB values or sprite
references.

### What's NOT connected

- `item.foreColor` is set to a single shared `itemColor` for all items (in
  `initializeItem`), not per-flavor. The "pink" potion isn't actually tinted pink.
- `item.kind` and `item.category` are not passed through the sprite pipeline — only
  `item.displayChar` reaches the renderer.
- The sprite assigner has no concept of item subtypes.

---

## Proposed Feature

Allow the sprite pipeline to select item sprites based on **category + kind** (or
**category + flavor**), not just `DisplayGlyph`. This would let the sprite assigner
map:

- "Pink potion" → pink potion sprite
- "Turquoise potion" → turquoise potion sprite
- "Axe" → axe sprite
- "Rapier" → rapier sprite
- "Leather armor" → leather armor sprite
- "Iron wand" → iron wand sprite

### Two Mapping Strategies

**Strategy A: Map by kind index**

Map `{category, kind}` → sprite. This is stable (kind indices don't change between
runs) but means "kind 0 potion always looks the same" regardless of its shuffled flavor.
Since the player eventually identifies what each potion does, the sprite for "potion of
strength" would always be the same color — which might spoil the identification
mechanic for repeat players.

**Strategy B: Map by flavor**

Map `{category, flavor}` → sprite. The "pink" potion always uses the pink sprite, but
"pink" might be strength in one run and paralysis in another. This preserves the
identification mystery and is more visually intuitive (the name says pink, the sprite
looks pink).

**Recommendation: Strategy B for flavored items, Strategy A for non-flavored.**

- Potions, wands, staffs, rings → map by flavor (color/material name)
- Weapons, armor → map by kind (axe, rapier, leather, plate)
- Scrolls → map by flavor if visual variety exists, otherwise single sprite
- Food, gold, keys → single sprite (no subtypes)

### Pipeline Changes

**1. Extend `getCellSpriteData` (sprite-appearance.ts)**

Pass `item.category`, `item.kind`, and `item.flavor` (or a derived lookup key) into the
layer entry so the renderer can use them for sprite selection.

```typescript
// New field on LayerEntry (or a dedicated ItemLayerEntry):
entry.itemCategory = item.category;
entry.itemKind = item.kind;
entry.itemFlavor = item.flavor;  // undefined after identification
```

**2. Extend sprite lookup in SpriteRenderer**

Add an item sprite map that the renderer checks before falling back to the glyph map:

```
Lookup chain:
  itemSpriteMap.get(`${category}:${flavor}`)   // "pink potion" → pink sprite
  ?? itemSpriteMap.get(`${category}:${kind}`)  // "weapon kind 3" → rapier sprite
  ?? spriteMap.get(displayGlyph)               // G_POTION → generic potion
  ?? text fallback
```

**3. Extend assignments.json**

Add an `items` section:

```json
{
    "items": {
        "POTION": {
            "pink": { "x": 0, "y": 5, "sheet": "Items" },
            "turquoise": { "x": 1, "y": 5, "sheet": "Items" },
            "puce": { "x": 2, "y": 5, "sheet": "Items" }
        },
        "WEAPON": {
            "0": { "x": 0, "y": 6, "sheet": "Items" },
            "1": { "x": 1, "y": 6, "sheet": "Items" }
        }
    }
}
```

**4. Sprite assigner UI**

Add an "Items" tab/section with:
- Category selector (Potion, Weapon, Armor, Wand, Staff, Ring, Scroll)
- Per-subtype sprite assignment grid (flavor-name or kind-name → sprite)
- Preview with the item's actual tint color applied

---

## Scope of Impact

| System | Change needed |
|--------|--------------|
| `sprite-appearance.ts` | Pass category/kind/flavor to layer entry |
| `render-layers.ts` | Extend `LayerEntry` with item identity fields |
| `sprite-renderer.ts` | Item-specific sprite lookup chain |
| `assignments.json` | New `items` section |
| `sprite-manifest.json` | May need schema extension |
| `tileset-bridge.ts` | Parse item sprite entries |
| Sprite Assigner V2 | New Items tab with per-subtype assignment |
| Dungeon Cake | Would need item stubs to test (roadmap item) |

---

## Open Questions

- **Identification state and sprites.** When a potion is unidentified, should it show
  the flavor-based sprite? When identified, should it switch to a kind-based sprite?
  Or always show the flavor sprite? The C game always shows the same glyph (`G_POTION`)
  regardless of identification — but that's because ASCII can't vary. With sprites, we
  could show the color-specific sprite always (matching the text description).

- **Per-run consistency.** If "pink" = strength in this run, the pink sprite always
  appears for strength potions. But in the next run, "pink" = paralysis. The sprite
  changes meaning between runs. This is correct and matches the game's identification
  mechanic — but is it confusing?

- **How many sprites are available?** DawnLike includes multiple potion colors (~10+),
  weapon types (~6), armor types (~4), wand/staff styles (~6). This covers the bulk of
  Brogue's item variety. Some items might not have distinct sprites and would fall back
  to the generic glyph sprite.

- **Item foreColor.** Currently all items share a single `itemColor` for tinting. If
  sprites are per-flavor, do we still need tinting at all for items? The sprite itself
  carries the color information. We might want to disable item tinting when a
  flavor-specific sprite exists.

- **Memory of dropped items.** When an item is on a tile the player can no longer see
  (remembered), does `rememberedItemCategory` + `rememberedItemKind` provide enough
  info to select the right sprite? Currently `rememberedItemCategory` and
  `rememberedItemKind` exist on `Pcell` but aren't used in the sprite path.

---

## Relationship to Other Work

| Initiative | Relationship |
|------------|-------------|
| 8 (Art Pipeline) | Closely related — item sprites are part of the art asset pipeline |
| 10 (Dev Tools) | Sprite assigner needs an Items section |
| Dungeon Cake roadmap | "Creature & item placement" would enable testing |
| Sprite Variation (sibling doc) | Similar manifest extension pattern |

---

## Risks

- **Cross-system scope.** This touches the sprite assigner, the manifest format, the
  sprite appearance pipeline, and the renderer. Coordinating changes across all four
  is the main complexity.
- **Flavor string brittleness.** Mapping by flavor string ("pink", "puce") ties sprites
  to string values in `string-tables.ts`. If those strings change, sprite mappings
  break. A stable enum or index would be safer but doesn't exist in the C codebase.
- **Art availability.** DawnLike has good potion/weapon variety but may not cover every
  Brogue subtype. Missing subtypes fall back to the generic sprite, which is fine but
  means the feature is visually incomplete until custom art fills the gaps.
