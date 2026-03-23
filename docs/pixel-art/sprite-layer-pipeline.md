# Sprite Layer Pipeline

> How each dungeon cell gets drawn in sprite mode. Explains layering order,
> which sprites appear on each layer, what effects are applied, and what
> parameters are available for tuning.
>
> **This document covers the pixel-art sprite pipeline only.** It does not
> describe the ASCII text renderer. Where the sprite pipeline shares
> infrastructure with ASCII (colors, tile catalog), those dependencies are
> called out explicitly — see [Shared ASCII Infrastructure](#shared-ascii-infrastructure).

---

## Overview

Every dungeon cell is a stack of transparent sprites composited onto a dark
background. The renderer paints them bottom to top:

```
 ┌─────────────────────────────┐
 │  Fog-of-war overlay         │  ← tints remembered / magic-mapped cells
 │  Layer 7: VISIBILITY        │  ← multiply fill from dungeon light color
 │  Layer 6: FIRE              │  ← fire on the cell
 │  Layer 5: GAS               │  ← poison gas, steam, etc.
 │  Layer 4: ENTITY            │  ← player or monster
 │  Layer 3: ITEM              │  ← weapon, potion, scroll on the ground
 │  Layer 2: SURFACE           │  ← decoration (grass, blood, webs)
 │  Layer 1: LIQUID            │  ← water, lava, mud, ice
 │  Layer 0: TERRAIN           │  ← wall, floor, door, stairs, chasm
 │  ── background fill ──      │  ← solid dark: rgb(10, 10, 18)
 └─────────────────────────────┘
```

Most cells only have 2–3 active layers. A typical lit floor cell:
background → TERRAIN → VISIBILITY.

### Summary

| Draw Order | Layer | Sprite Source | Tint | Alpha | Notes |
|-----------|-------|-------------|------|-------|-------|
| 1st | Background fill | — | — | — | Solid `rgb(10,10,18)` |
| 2nd | 0: TERRAIN | TileType (+ autotile variants) | **Disabled** | 1.0 | Original PNG colors |
| 3rd | 1: LIQUID | TileType (+ autotile variants) | **Disabled** | 0.55 shallow, else 1.0 | Water, lava, mud, ice |
| 4th | 2: SURFACE | TileType | **Disabled** | 1.0 | Decorations (grass, blood, webs) |
| 5th | 3: ITEM | DisplayGlyph | **Disabled** | 1.0 | Only if no ENTITY |
| 6th | 4: ENTITY | DisplayGlyph | **Disabled** | 1.0 | Player or monster |
| 7th | 5: GAS | TileType | **Disabled** | volume / 100 | Volume-based transparency |
| 8th | 6: FIRE | TileType | **Disabled** | 1.0 | From surface or gas ignition |
| 9th | 7: VISIBILITY | — (color fill) | Multiply composite | 1.0 | Dungeon lighting |
| 10th | Fog overlay | — (color fill) | Multiply or source-over | Varies | Remembered/clairvoyant tints |

> Tint data from `foreColor`/`backColor` is still computed (for F2 debug
> inspection and `colorDances` detection) but not rendered. Per-layer tinting
> can be re-enabled via the F2 panel's tint override or blend mode controls.
> See [Shared ASCII Infrastructure](#shared-ascii-infrastructure).

---

## Shared ASCII Infrastructure

The sprite pipeline reuses several data sources that were originally designed
for ASCII terminal rendering. These are potential risk areas — changing them
affects both pipelines, and the values were tuned for terminal colors, not
pixel-art sprites.

| Shared Element | Source | How Sprites Use It | Status |
|---|---|---|---|
| `tileCatalog[tile].foreColor` | `globals/colors.ts` → `tile-catalog.ts` | Computed into tint data but **not rendered** (tinting disabled on layers 0–6) | Harmless — data computed for debug/`colorDances` only |
| `tileCatalog[tile].backColor` | Same | Computed into GAS tint but **not rendered**; feeds `bgColor` for `bakeTerrainColors` | Same — computed but never drawn |
| `bakeTerrainColors()` | `io/display.ts` | Resolves random color components; propagates `colorDances` flag. Tint output **not rendered**. | Retained for `colorDances` detection |
| `monsterCatalog[m].foreColor` | `globals/monster-catalog.ts` | Computed into ENTITY tint but **not rendered** | Harmless |
| `item.foreColor` | Item objects | Computed into ITEM tint but **not rendered** | Harmless |
| `lightMultiplierColor` | `colorMultiplierFromDungeonLight()` | VISIBILITY layer lighting overlay — **actively rendered** | **Intentionally shared** — this one is fine |
| `drawPriority` | `tileCatalog` | No longer used by sprite pipeline (liquid has its own LIQUID layer) | Obsolete for sprites; still present in tile catalog for ASCII |
| `colorDances` | `Color.colorDances` flag | Triggers per-frame re-render for shimmer effect | **Intentionally shared** — this one is fine |

**What is the tile catalog?** An array of 217 entries (`tileCatalog` in
`globals/tile-catalog.ts`), one per `TileType`. Each entry is a `FloorTileType`
with fields for appearance (`foreColor`, `backColor`, `displayChar`,
`drawPriority`), behavior (`chanceToIgnite`, `fireType`, `promoteType`), and
text (`description`, `flavorText`). Originally the sole data source for ASCII
rendering — the sprite pipeline indexes into it to get tint colors and
draw-priority values.

---

## Background Fill

The entire cell is filled with a fixed dark color before any layers draw.

**Color:** `rgb(10, 10, 18)` — a near-black with a slight blue tint.

The game also computes a `bgColor` per cell (from `tileCatalog[tile].backColor`),
but the sprite renderer **ignores it** for the canvas fill. This was a deliberate
choice: colored backgrounds (orange from lava, blue from water) washed out the
sprites. The constant dark fill lets the pixel-art sprites provide their own
color.

The computed `bgColor` is still used internally for `bakeTerrainColors` (subtle
color variation) and `colorDances` detection, but never painted to the canvas.

### Parameters

| Parameter | Current Value | Configurable? |
|-----------|--------------|---------------|
| Fill color | `rgb(10, 10, 18)` | Yes — F2 panel "Override bgColor" checkbox + color picker |

---

## Layer 0: TERRAIN

The structural tile of the cell — walls, floors, doors, stairs, chasms,
bridges, traps, altars, machines, and everything else that defines the dungeon
layout. Every visible cell has a TERRAIN layer.

### Sprite Source

Looked up by `TileType` from `tileTypeSpriteMap`. For wall-group tiles with
autotiling enabled, the sprite comes from the autotile variant map (47 variants
based on 8-neighbor configuration). Non-autotiled tiles use their single
assigned sprite.

### Tile Types

**Walls & stone:**
GRANITE, WALL, SECRET_DOOR, TORCH_WALL, CRYSTAL_WALL, OBSIDIAN,
MUD_WALL, WORM_TUNNEL_OUTER_WALL, RAT_TRAP_WALL_DORMANT,
RAT_TRAP_WALL_CRACKING, WALL_MONSTER_DORMANT, ELECTRIC_CRYSTAL_OFF,
ELECTRIC_CRYSTAL_ON

**Floors:**
FLOOR, FLOOR_FLOODABLE, CARPET, MARBLE_FLOOR, DARK_FLOOR,
DARK_FLOOR_DORMANT, DARK_FLOOR_DARKENING, MACHINE_TRIGGER_FLOOR,
MACHINE_TRIGGER_FLOOR_REPEATING, MUD_FLOOR

**Doors & barriers:**
DOOR, OPEN_DOOR, LOCKED_DOOR, OPEN_IRON_DOOR_INERT, PORTCULLIS_CLOSED,
PORTCULLIS_DORMANT, WOODEN_BARRICADE, MUD_DOORWAY

**Stairs & exits:**
DOWN_STAIRS, UP_STAIRS, DUNGEON_EXIT, DUNGEON_PORTAL, PORTAL

**Torches & lights:**
PILOT_LIGHT_DORMANT, PILOT_LIGHT, HAUNTED_TORCH_DORMANT,
HAUNTED_TORCH_TRANSITIONING, HAUNTED_TORCH, BRAZIER

**Levers & switches:**
WALL_LEVER_HIDDEN, WALL_LEVER, WALL_LEVER_PULLED,
WALL_LEVER_HIDDEN_DORMANT, TURRET_LEVER, AMULET_SWITCH

**Statues:**
STATUE_INERT, STATUE_DORMANT, STATUE_CRACKING, STATUE_INSTACRACK,
STATUE_INERT_DOORWAY, STATUE_DORMANT_DOORWAY, DEMONIC_STATUE

**Cages & coffins:**
MONSTER_CAGE_OPEN, MONSTER_CAGE_CLOSED, SACRIFICE_CAGE_DORMANT,
COFFIN_CLOSED, COFFIN_OPEN

**Altars & pedestals:**
ALTAR_INERT, ALTAR_KEYHOLE, ALTAR_CAGE_OPEN, ALTAR_CAGE_CLOSED,
ALTAR_SWITCH, ALTAR_SWITCH_RETRACTING, ALTAR_CAGE_RETRACTABLE,
PEDESTAL, COMMUTATION_ALTAR, COMMUTATION_ALTAR_INERT,
RESURRECTION_ALTAR, RESURRECTION_ALTAR_INERT,
SACRIFICE_ALTAR_DORMANT, SACRIFICE_ALTAR

**Traps (hidden & revealed):**
GAS_TRAP_POISON_HIDDEN, GAS_TRAP_POISON,
TRAP_DOOR_HIDDEN, TRAP_DOOR,
GAS_TRAP_PARALYSIS_HIDDEN, GAS_TRAP_PARALYSIS,
GAS_TRAP_CONFUSION_HIDDEN, GAS_TRAP_CONFUSION,
FLAMETHROWER_HIDDEN, FLAMETHROWER,
FLOOD_TRAP_HIDDEN, FLOOD_TRAP,
NET_TRAP_HIDDEN, NET_TRAP,
ALARM_TRAP_HIDDEN, ALARM_TRAP

**Machine vents:**
MACHINE_PARALYSIS_VENT_HIDDEN, MACHINE_PARALYSIS_VENT,
MACHINE_POISON_GAS_VENT_HIDDEN, MACHINE_POISON_GAS_VENT_DORMANT,
MACHINE_POISON_GAS_VENT,
MACHINE_METHANE_VENT_HIDDEN, MACHINE_METHANE_VENT_DORMANT,
MACHINE_METHANE_VENT, STEAM_VENT

**Machine misc:**
MACHINE_PRESSURE_PLATE, MACHINE_PRESSURE_PLATE_USED,
MACHINE_GLYPH, MACHINE_GLYPH_INACTIVE,
TURRET_DORMANT, WORM_TUNNEL_MARKER_DORMANT,
WORM_TUNNEL_MARKER_ACTIVE

**Dewars:**
DEWAR_CAUSTIC_GAS, DEWAR_CONFUSION_GAS,
DEWAR_PARALYSIS_GAS, DEWAR_METHANE_GAS

**Chasms & holes:**
CHASM, CHASM_EDGE, MACHINE_COLLAPSE_EDGE_DORMANT,
MACHINE_COLLAPSE_EDGE_SPREADING, MACHINE_CHASM_EDGE,
CHASM_WITH_HIDDEN_BRIDGE, CHASM_WITH_HIDDEN_BRIDGE_ACTIVE,
HOLE, HOLE_GLOW, HOLE_EDGE

**Bridges:**
BRIDGE, BRIDGE_FALLING, BRIDGE_EDGE, STONE_BRIDGE

**Terrain effects:**
SUNLIGHT_POOL, DARKNESS_PATCH, INERT_BRIMSTONE

**Pipes:**
PIPE_GLOWING, PIPE_INERT

**Special:**
NOTHING

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Skipped** (blend mode `"none"`) | Yes — F2 panel can enable per-layer tint override | TERRAIN intentionally draws with original PNG colors |
| Alpha | 1.0 (opaque) | Yes — F2 panel alpha slider | |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | Default is "none" to preserve sprite art |
| Autotile variant | 0–46 (from adjacency bitmask) | Visible via F2 "Show Variant Indices" toggle | Only for tiles in a connection group with a loaded spritesheet |

### Potential Additional Parameters

| Parameter | Canvas2D API | Use Case |
|-----------|-------------|----------|
| Filter | `ctx.filter` | `brightness()`, `contrast()`, `saturate()` for atmospheric effects |
| Shadow | `shadowBlur`, `shadowColor` | Glow effects on torch walls, crystals |
| Image smoothing | `imageSmoothingEnabled` | Toggle pixel-perfect vs smoothed at non-integer scales |
| Transform | `rotate()`, `scale(-1,1)` | Flip sprites, slight rotation for organic variety |

---

## Layer 1: LIQUID

All liquid tiles — water, lava, ice, mud. Drawn between TERRAIN and SURFACE
so that liquid and surface decorations (foliage, blood, webs) can coexist on
the same cell. Shallow liquids draw semi-transparent (alpha 0.55) so the
floor tile underneath is visible.

### Sprite Source

Looked up by `TileType` from `tileTypeSpriteMap`. Autotiling applies to liquid
tiles in connection groups (WATER, LAVA, ICE, MUD) when a variant spritesheet
is loaded.

### Tile Types

Placed by the game on `DungeonLayer.Liquid`.

**Water:**
DEEP_WATER, SHALLOW_WATER, FLOOD_WATER_DEEP, FLOOD_WATER_SHALLOW,
MACHINE_FLOOD_WATER_DORMANT, MACHINE_FLOOD_WATER_SPREADING,
DEEP_WATER_ALGAE_WELL, DEEP_WATER_ALGAE_1, DEEP_WATER_ALGAE_2

**Lava:**
LAVA, LAVA_RETRACTABLE, LAVA_RETRACTING, ACTIVE_BRIMSTONE,
SACRIFICE_LAVA

**Ice:**
ICE_DEEP, ICE_DEEP_MELT, ICE_SHALLOW, ICE_SHALLOW_MELT

**Mud:**
MUD, MACHINE_MUD_DORMANT

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Disabled** (original PNG colors) | Yes — F2 panel tint override re-enables | Tint data still computed for debug inspection |
| Alpha | 0.55 for shallow liquids, 1.0 otherwise | Yes — F2 panel alpha slider | Shallow: SHALLOW_WATER, FLOOD_WATER_SHALLOW, ICE_SHALLOW, ICE_SHALLOW_MELT, MUD |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | |
| Autotile variant | 0–46 (from adjacency bitmask) | Visible via F2 "Show Variant Indices" toggle | Only for tiles in a connection group with a loaded spritesheet |

---

## Layer 2: SURFACE

Surface decorations — vegetation, blood, debris, webs, magical effects.
Drawn above LIQUID, so decorations render on top of any liquid on the same
cell.

### Sprite Source

Looked up by `TileType` from `tileTypeSpriteMap`.

### Tile Types

Placed by the game on `DungeonLayer.Surface`. Must pass `isSurfaceTileType()`.

**Vegetation:**
GRASS, DEAD_GRASS, FOLIAGE, DEAD_FOLIAGE, TRAMPLED_FOLIAGE,
FUNGUS_FOREST, TRAMPLED_FUNGUS_FOREST, HAY,
GRAY_FUNGUS, LUMINESCENT_FUNGUS, LICHEN

**Blood & fluids:**
RED_BLOOD, GREEN_BLOOD, PURPLE_BLOOD, ACID_SPLATTER, VOMIT,
URINE, UNICORN_POOP, WORM_BLOOD, ECTOPLASM

**Debris & damage:**
ASH, BURNED_CARPET, RUBBLE, JUNK, BROKEN_GLASS, EMBERS, PUDDLE, BONES

**Webs & nets:**
SPIDERWEB, NETTING

**Magic & special:**
FORCEFIELD, FORCEFIELD_MELT, SACRED_GLYPH, PORTAL_LIGHT, GUARDIAN_GLOW

**Manacles:**
MANACLE_TL, MANACLE_BR, MANACLE_TR, MANACLE_BL,
MANACLE_T, MANACLE_B, MANACLE_L, MANACLE_R

**Plants:**
BLOODFLOWER_STALK, BLOODFLOWER_POD

**Other:**
HAVEN_BEDROLL, ANCIENT_SPIRIT_VINES, ANCIENT_SPIRIT_GRASS

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Disabled** (original PNG colors) | Yes — F2 panel tint override re-enables | Tint data still computed for debug inspection |
| Alpha | 1.0 | Yes — F2 panel alpha slider | |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | |

---

## Layer 3: ITEM

An item lying on the ground. Only drawn if no creature (ENTITY) occupies the
cell — creatures visually cover items.

### Sprite Source

Looked up by `DisplayGlyph` from `spriteMap`. Items use character glyphs, not
TileTypes.

### Display Glyphs

**Consumables:** G_POTION, G_FOOD, G_SCROLL

**Equipment:** G_ARMOR, G_WEAPON, G_RING, G_CHARM, G_STAFF, G_WAND

**Treasure:** G_GOLD, G_GEM, G_AMULET

**Utility:** G_KEY

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Disabled** (original PNG colors) | Yes — F2 panel tint override re-enables | Tint data still computed for debug inspection |
| Alpha | 1.0 | Yes — F2 panel alpha slider | |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | |

### Special Cases

- **Hallucination:** When the player is hallucinating, item glyph and color are
  randomized — you see a random item category with a generic `itemColor`.

---

## Layer 4: ENTITY

The player character or a visible monster.

### Sprite Source

Looked up by `DisplayGlyph` from `spriteMap`. Uses the creature's
`info.displayChar`.

### Display Glyphs

**Player:** G_PLAYER

**Monsters (alphabetical):**
G_ANCIENT_SPIRIT, G_BAT, G_BLOAT, G_BOG_MONSTER, G_CENTAUR,
G_CENTIPEDE, G_DAR_BATTLEMAGE, G_DAR_BLADEMASTER, G_DAR_PRIESTESS,
G_DEMON, G_DRAGON, G_EEL, G_EGG, G_FLAMEDANCER, G_FURY,
G_GOBLIN, G_GOBLIN_CHIEFTAN, G_GOBLIN_MAGIC, G_GOLEM, G_GUARDIAN,
G_IMP, G_IFRIT, G_JACKAL, G_JELLY, G_KOBOLD, G_KRAKEN, G_LICH,
G_MONKEY, G_MOUND, G_NAGA, G_OGRE, G_OGRE_MAGIC, G_PHANTOM,
G_PHOENIX, G_PIXIE, G_RAT, G_REVENANT, G_SALAMANDER, G_SPIDER,
G_TENTACLE_HORROR, G_TOAD, G_TROLL, G_UNDERWORM, G_UNICORN,
G_VAMPIRE, G_WARDEN, G_WINGED_GUARDIAN, G_WISP, G_WRAITH, G_ZOMBIE

**Stationary:** G_TOTEM, G_TURRET

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Disabled** (original PNG colors) | Yes — F2 panel tint override re-enables | Tint data still computed for debug inspection |
| Alpha | 1.0 | Yes — F2 panel alpha slider | |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | |

### Special Cases

- **Hallucination:** Monster glyph randomized (you see random creatures)
- **Invisible in gas:** ENTITY tint is replaced with the GAS layer's tint
  color — the creature appears as a gas-colored silhouette
- **Player priority:** If the player is on the cell, ENTITY is always the
  player; ITEM layer is suppressed

---

## Layer 5: GAS

Poison gas, steam, confusion gas, and similar cloud effects.

### Sprite Source

Looked up by `TileType` from `tileTypeSpriteMap`.

### Tile Types

POISON_GAS, CONFUSION_GAS, ROT_GAS, STENCH_SMOKE_GAS, PARALYSIS_GAS,
METHANE_GAS, STEAM, DARKNESS_CLOUD, HEALING_CLOUD

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Disabled** (original PNG colors) | Yes — F2 panel tint override re-enables | Tint data still computed for debug inspection |
| Alpha | `min(1.0, cell.volume / 100)` | Yes — F2 panel alpha slider | Thin gas = nearly transparent; thick gas = opaque |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | |

---

## Layer 6: FIRE

Fire effects. Can originate from either `DungeonLayer.Surface` (burning terrain)
or `DungeonLayer.Gas` (ignited gas). Both route to this render layer.

### Sprite Source

Looked up by `TileType` from `tileTypeSpriteMap`.

### Tile Types

PLAIN_FIRE, BRIMSTONE_FIRE, FLAMEDANCER_FIRE, GAS_FIRE, GAS_EXPLOSION,
DART_EXPLOSION, ITEM_FIRE, CREATURE_FIRE

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Tint | **Disabled** (original PNG colors) | Yes — F2 panel tint override re-enables | Tint data still computed for debug inspection |
| Alpha | 1.0 | Yes — F2 panel alpha slider | |
| Blend mode | `"none"` (no tinting) | Yes — F2 panel blend mode dropdown | |

---

## Layer 7: VISIBILITY (Lighting)

**Not a sprite.** This layer is a full-cell color fill using Canvas2D
`multiply` compositing. It simulates dungeon lighting — darkening and tinting
everything drawn underneath.

### How It Works

The game computes a `lightMultiplierColor` for each cell based on nearby light
sources (torches, glowing creatures, magic effects). This color becomes a
multiply fill over the entire cell:

- **White (100, 100, 100):** Fully lit. No visual effect.
- **Darker values:** Cell is in shadow. `(50, 50, 50)` halves all colors.
- **Colored values:** Tinted light. `(100, 50, 50)` shifts the cell reddish.

The multiplier is always the same for all layers on a cell — TERRAIN, LIQUID,
SURFACE, ITEM, ENTITY, GAS, FIRE all get darkened/tinted uniformly.

**Not drawn for remembered cells.** Remembered and magic-mapped cells skip this
layer entirely — they use only the fog-of-war overlay.

### Parameters

| Parameter | Current Value | Configurable? | Notes |
|-----------|--------------|---------------|-------|
| Light color | From `colorMultiplierFromDungeonLight()` | Layer can be toggled off via F2 | This is intentionally shared with ASCII — it's the game's lighting system |
| Blend mode | `"multiply"` (hardcoded) | Not yet | Always multiply; fixed in `applyLightingOverlay()` |

---

## Post-Layer: Fog-of-War Overlay

After all 8 layers, a final overlay may be applied based on the cell's
visibility state. This is NOT a RenderLayer — it runs after the layer loop.

| Visibility State | Effect | Color (Brogue 0–100 scale) | Notes |
|-----------------|--------|---------------------------|-------|
| **Visible** | None | — | No overlay |
| **Remembered** | Multiply fill | `(25, 25, 50)` — muted blue | Normal remembered cells |
| **Remembered + underwater** | 80% black fill | Black at alpha 0.8 | Heavy darkening for underwater memory |
| **Clairvoyant** | Multiply fill | `(50, 90, 50)` — green | Clairvoyance spell |
| **Telepathic** | Multiply fill | `(30, 30, 130)` — deep blue | Telepathy |
| **Magic Mapped** | Multiply fill | `(60, 20, 60)` — magenta | Magic mapping |
| **Omniscience** | Multiply fill | `(140, 100, 60)` — warm gold | Omniscience mode |
| **Shroud** | Nothing drawn | — | Cell stays as background fill |

### Parameters

| Parameter | Current Value | Configurable? |
|-----------|--------------|---------------|
| Overlay enabled | Yes | Yes — F2 panel "Visibility Overlay" checkbox |

---

## Layers 8–10: Not Yet Implemented

| Layer | Name | Future Use |
|-------|------|-----------|
| 8 | STATUS | On-fire, paralyzed, entranced overlays on creatures |
| 9 | BOLT | Bolt/projectile trail animations |
| 10 | UI | Targeting cursors, selection highlights |

---

## F2 Debug Panel

Press **F2** to open the sprite layer debug panel. Controls per layer:

- **Checkbox:** Toggle layer visibility on/off
- **Tint picker:** Override the game's tint with a fixed color
- **Alpha slider:** Override layer opacity
- **Blend mode:** Change the compositing operation

Global controls:

- **Visibility Overlay:** Toggle fog-of-war overlay on/off
- **Show Variant Indices:** Draw autotile variant number on each autotiled cell
- **Override bgColor:** Replace the dark background with a custom color
- **Click a cell:** Shows actual tint values, autotile bitmask/variant/group,
  and a 3×3 neighbor connectivity grid

---

## Key Files

| File | Role |
|------|------|
| `src/io/sprite-appearance.ts` | `getCellSpriteData()` — fills the layer stack from game state |
| `src/platform/sprite-renderer.ts` | `drawCellLayers()` — draws the layer stack to canvas |
| `src/platform/render-layers.ts` | Layer enum, overlay configs, tile classifiers |
| `src/platform/sprite-debug.ts` | F2 debug panel |
| `src/platform/autotile.ts` | Connection groups, bitmask computation, variant lookup |
| `src/platform/glyph-sprite-map.ts` | Sprite assignments (TileType → sprite, glyph → sprite) |
| `src/platform/tileset-loader.ts` | Spritesheet PNG loading |
| `src/globals/tile-catalog.ts` | Master tile catalog (appearance, behavior, text per TileType) |
| `src/globals/colors.ts` | Color definitions used by tile catalog |
