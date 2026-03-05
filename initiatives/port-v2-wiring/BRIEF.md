# Port V2 — Wiring

## Intent
Write the domain-split wiring layer that replaces `runtime.ts`. This is the core new work of the second attempt: 7-8 focused context builder files, each under 600 lines, together providing all the dependency injection that the game logic modules need.

## Goals
- `core.ts` holds all shared mutable state (player, rogue, pmap, monsters, items) and game lifecycle functions
- Each domain file (`turn.ts`, `combat.ts`, `monsters.ts`, `items.ts`, `movement.ts`, `ui.ts`) provides its `buildXxxContext()` functions and stays under 600 lines
- Every domain file has at least one integration test before it is considered done
- The four critical integration tests pass: turn cycle with dying monster, combat → death → cleanup, item use cycle, level transition
- Zero undocumented stubs — any simplified implementation has a corresponding `test.skip` with a description of the correct behavior

## Scope
What's in:
- `rogue-ts/src/core.ts` — shared state + lifecycle
- `rogue-ts/src/turn.ts` — turn processing context builders
- `rogue-ts/src/combat.ts` — combat context builders
- `rogue-ts/src/monsters.ts` — monster context builders
- `rogue-ts/src/items.ts` — item context builders
- `rogue-ts/src/movement.ts` — movement context builders
- `rogue-ts/src/ui.ts` — display/UI context builders (stubs pointing at IO layer are fine here)
- Integration tests for each of the above

What's out:
- The actual IO/display implementations — those functions are referenced in context builders but implemented in port-v2-platform
- The browser event loop and main game loop — also port-v2-platform
- Menus and platform rendering

## Constraints
- No domain file may exceed 600 lines — split if needed
- Every stub must have a `test.skip` before this initiative is complete
- Do not copy context builder logic from `ts/src/runtime.ts` wholesale — write each builder fresh, referencing the C source and the first attempt's logic as references, not as copy-paste sources
