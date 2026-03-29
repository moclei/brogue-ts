# Debug Cheat Panel — Plan

## Approach

A floating HTML `<div>` panel wired to F2 in `bootstrap.ts`. Same DOM overlay technique as the existing `sprite-debug.ts` panel (create on first open, show/hide on toggle). Three controls wired to live game state via the `getGameState()` singleton.

### Architecture

```
bootstrap.ts (F2 keydown)
    ↓
toggleGameDebugPanel(canvasParent)
    ↓
game-debug-panel.ts
    ├── Invincibility checkbox → D_IMMORTAL (mutable let)
    ├── Depth input + Jump button → rogue.depthLevel + startLevel()
    └── Category dropdown → Kind dropdown + Give button
            → buildDebugItemContext() → generateItem() → addItemToPack()
            → forceFullRedraw()
```

### Control 1: Invincibility Toggle

Change `D_IMMORTAL` in `game-init.ts` from `export const` to `export let`. The panel imports it directly and flips it on checkbox change. The existing death guard in `game-lifecycle.ts:228,281` reads the value each time — no further changes.

State is session-only (module-level variable). Panel re-reads it on open to show current state.

### Control 2: Depth Jump

On click:
1. Read `getGameState().rogue.depthLevel` as `oldDepth`
2. Set `rogue.depthLevel = targetDepth`
3. Call `startLevel(oldDepth, 1)` — synchronous, generates the new level in-place

JS is single-threaded: if the game is `await`-ing `waitForEvent()`, the click handler runs to completion and the new level is ready when the game loop resumes. Safe for the common case (player idle, waiting for input). Depth jump during mid-combat animation is undefined behavior for a dev tool — acceptable.

`startLevel` is exported from `lifecycle.ts:605` and wraps `startLevelFn(buildLevelContext(), ...)`. It's synchronous and expects `rogue.depthLevel` to already reflect the target depth at call time.

### Control 3: Give Item

Two-level dropdowns: Category (Weapon, Armor, Food, Potion, Scroll, Staff, Wand, Ring, Charm) → Kind (populates dynamically, ~2–20 items per category). Changing the category clears and repopulates the Kind dropdown. Item names come from the item kind tables in `rogue-ts/src/globals/`.

On Give:
1. `buildDebugItemContext()` — new helper in `lifecycle.ts` that builds the minimal `ItemGenContext` from `getGameState()`. Follows the same pattern as `buildLevelContext()`, `buildMenuContext()`, etc.
2. `generateItem(category, kind, ctx)` — produces a fully initialized item
3. `addItemToPack(item, state.rogue.packItems)` — adds to player inventory
4. `forceFullRedraw()` — sidebar updates immediately

## Technical Notes

### Item kind tables for dropdown population

Weapon kinds, armor kinds, potion/scroll/staff/wand/ring/charm kinds are defined in `rogue-ts/src/globals/`. The category→kind mapping for the dropdown UI can be built as a static array in `game-debug-panel.ts` using the same enum values as `generateItem`. The panel does not need to import live tables — just the enum names and their integer values.

### `buildDebugItemContext()` in lifecycle.ts

Mirrors the existing context builders. Needs: RNG accessors, item tables (potionTable, scrollTable, etc. from game state), `getGameState().rogue`. Should be colocated with `buildLevelContext()` at the bottom of `lifecycle.ts`. If it would push `lifecycle.ts` past 600 lines, extract to a new `lifecycle-debug.ts`.

### Why not use the existing wizard dialog

`dialogCreateItemOrMonster()` in `wizard-items.ts` is designed to be called from within the game's async event loop (it runs its own `waitForEvent()` sub-loop). Triggering it from a DOM button handler would require event injection. The simpler HTML dropdown achieves the same result without touching the event dispatch path.

## Open Questions

*None.*
