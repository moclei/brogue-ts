# Pixel Art Renderer Refactor

## Intent

Extract a `Renderer` interface from the monolithic `plotChar()` function in
`browser-renderer.ts` and split the rendering logic into `TextRenderer` and
`SpriteRenderer` implementations. This cleans up the prototype code left by
three prior pixel-art initiatives and creates the extension point for all
future rendering work (layers, autotiling, creature facing, animations).

## Goals

- A formal `Renderer` interface that both text and sprite renderers implement
- `TextRenderer`: the current `fillText` path, extracted cleanly
- `SpriteRenderer`: sprite lookup, tinting, two-layer draw, text fallback —
  all extracted from `plotChar` and the closure inside it
- Sprite map data, tileset loading, and tinting stay with `SpriteRenderer`;
  shared infrastructure (cell sizing, events, input queue) stays in the console
- Mode switching (G key → Text / Tiles / Hybrid) selects the active renderer
- Progressive integer-division cell sizing from tiles.c (gap-free rendering)
- `browser-renderer.ts` drops below 600 lines (currently 689, over the limit)

## Scope

What's in:
- Renderer interface definition and two implementations
- Extraction of all drawing code from `plotChar` into renderer classes
- Wiring mode switching to renderer selection
- Progressive cell sizing (from Section 3.1C of pixel-art-exploration.md)
- Updating `bootstrap.ts` init flow to construct renderers
- Tests for the new renderer interface, cell sizing math, and mode switching

What's out:
- New rendering features (layers, autotiling, creature facing, animations)
- Changes to the display pipeline (`getCellAppearance`, `plotCharWithColor`,
  `commitDraws`, `plotCharToBuffer`)
- Changes to sprite maps or tileset content (existing maps move, not change)
- Art pipeline or white-sprite tinting (separate initiative)
- `CellRenderData` interface from Section 3.S (that's for Initiative 2: layers)
- WebGL or PixiJS migration

## Constraints

- **This is a refactor.** Existing rendering must not break — text mode, tile
  mode, and hybrid mode must all produce identical output before and after.
- **600 lines max per file.** `browser-renderer.ts` is currently over this
  limit; the refactor must bring it under. New files must stay under too.
- **No stub without a `test.skip`.** Any incomplete implementations need a
  corresponding skipped test.
- **G-key cycling must work.** Text → Tiles → Hybrid → Text. Full redraw on
  mode switch. Sidebar/messages always text.
- **Prototype code moves, it doesn't get rewritten.** The drawSpriteTinted
  logic, foreground/background layer draw, creature underlyingTerrain draw —
  all of this works and should be extracted ~intact into SpriteRenderer.
- Parent: `docs/pixel-art/pixel-art-exploration.md` Section 4c, Section 3.S.
