# Port V2 — Scaffold — Plan

## Approach

Copy the reusable module files from `ts/src/` to `rogue-ts/src/`, set up the project tooling, and verify compilation and tests. This is mostly mechanical — the point is to establish a clean, verified baseline with no accumulated wiring debt.

### Folder structure

```
rogue-ts/
  src/
    types/         ← copy from ts/src/types/
    math/          ← copy from ts/src/math/
    globals/       ← copy from ts/src/globals/
    grid/          ← copy from ts/src/grid/
    dijkstra/      ← copy from ts/src/dijkstra/
    architect/     ← copy from ts/src/architect/ (see note)
    combat/        ← copy from ts/src/combat/ (see note)
    game/          ← copy from ts/src/game/
    items/         ← copy from ts/src/items/
    monsters/      ← copy from ts/src/monsters/
    movement/      ← copy from ts/src/movement/
    light/         ← copy from ts/src/light/
    time/          ← copy from ts/src/time/
    power/         ← copy from ts/src/power/
    state/         ← copy from ts/src/state/
  tests/           ← copy test files that cover the above modules
  package.json
  tsconfig.json
  vitest.config.ts (or equivalent)
```

The wiring files (`core.ts`, `turn.ts`, `combat.ts`, etc.) and IO files do not exist yet.

### Files needing minor adaptation

Five files have cross-module dependencies that need a small adjustment to fit the DI pattern cleanly:

| File | Issue | Fix |
|------|-------|-----|
| `combat/combat-attack.ts` | Direct monster dependency | Verify already uses DI context; no change likely needed |
| `combat/combat-math.ts` | Item/monster lookups | Verify DI; no change likely needed |
| `combat/combat-runics.ts` | Item ability resolution | Verify DI; no change likely needed |
| `items/item-ops.ts` | Architect dependency | Verify DI; no change likely needed |
| `monsters/monster-ops.ts` | Architect dependency | Verify DI; no change likely needed |

Note: These were flagged as "with modifications" but since all these files already use the DI context pattern, they may compile as-is. Verify each one during the copy step — only adapt if compilation fails.

### Known stub-heavy files to watch

Two files have significant unimplemented areas in the first attempt:
- `architect/architect.ts` — 7 stubs (restoreMonster, restoreItems, and others)
- `monsters/monster-actions.ts` — several simplified implementations

Copy them as-is. Do NOT attempt to fix stubs during this phase. The TASKS.md for port-v2-wiring will enumerate what still needs implementing.

## Technical Notes

### Project setup
Copy `ts/package.json` and `ts/tsconfig.json` as starting points, adjusting paths from `ts/` to `rogue-ts/`. The test framework (vitest) and TypeScript version should remain identical.

### Test strategy during scaffold
Run only the unit tests that came with the copied modules. These should all pass. If any fail, it indicates a copy error or a dependency on something in `runtime.ts` that needs to be resolved. Fix those before proceeding.

## Decisions Made

### Files needing modification
None. All five flagged files (combat-attack, combat-math, combat-runics, item-ops, monster-ops) compiled as-is — they already use DI context throughout.

### Tests excluded from scaffold
One test file excluded: `debug-player-placement.test.ts` — imports from `runtime.ts`. Needs integration test in port-v2-wiring.

Platform/IO test directories excluded entirely (io/, menus/, recordings/) — those belong in port-v2-platform.

### 600-line rule vs copy-as-is
29 files exceed 600 lines. These are all inherited from the first attempt and were designated "copy as-is." Two categories:

**Data catalog files (cannot be split — structured lookup tables):**
- `globals/tile-catalog.ts` — 3700 lines
- `globals/dungeon-feature-catalog.ts` — 3143 lines
- `globals/blueprint-catalog.ts` — 799 lines

**Logic files — must be split during port-v2-wiring (not scaffold):**
- `architect/machines.ts` — 1977 lines
- `time/creature-effects.ts` — 1363 lines
- `items/item-handlers.ts` — 1278 lines
- `monsters/monster-actions.ts` — 1228 lines
- `monsters/monster-state.ts` — 937 lines
- `game/game-init.ts` — 922 lines
- `movement/player-movement.ts` — 913 lines
- `movement/travel-explore.ts` — 901 lines
- `monsters/monster-movement.ts` — 884 lines
- `time/turn-processing.ts` — 858 lines
- `architect/architect.ts` — 772 lines
- `items/item-naming.ts` — 715 lines
- `types/types.ts` — 694 lines
- `game/game-level.ts` — 688 lines
- `movement/map-queries.ts` — 687 lines
- `combat/combat-helpers.ts` — 683 lines
- `combat/combat-attack.ts` — 677 lines
- `types/enums.ts` — 666 lines
- `architect/lakes.ts` — 666 lines
- `game/game-lifecycle.ts` — 665 lines
- `items/item-generation.ts` — 644 lines
- `architect/rooms.ts` — 639 lines
- `monsters/monster-spawning.ts` — 615 lines
- `power/power-tables.ts` — 610 lines
- `time/environment.ts` — 609 lines
- `items/item-usage.ts` — 608 lines

The scaffold phase does not attempt to split these — splitting logic files requires understanding the wiring context that doesn't exist yet. The port-v2-wiring initiative TASKS.md should enumerate which files to split as part of its work.
