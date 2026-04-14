# BrogueCE TypeScript Port — Second Attempt

**Decision:** Restart after 5-day first attempt. See `docs/FIRST_PORT_ANALYSIS.md` for full retrospective.

**New folder:** `rogue-ts/` (first attempt preserved in `ts/` for reference)

---

## What We Learned

The first attempt produced working, playable code but hit a ceiling because of one structural mistake: everything was wired through a single 8,456-line `runtime.ts`. Every bug investigation required loading that file. Context windows saturated. Bug fixes slowed to a crawl.

The second attempt is organized around three rules:

1. **No file over 600 lines.** If something is growing past that, it needs to be split. This is a hard constraint, not a guideline.
2. **No stub without a failing test.** A stub is only allowed if there is a `test.skip` proving what the correct behavior should be. Stubs are visible via the test runner — no separate tracking doc needed.
3. **Each session targets one file or one subsystem.** Context window management is a first-class constraint. Sessions are scoped so the files needed fit comfortably in context.

---

## What We're Reusing

The first attempt is not wasted. Analysis shows 60% of the codebase (82 files, ~40K lines) is **reusable exactly as-is** — all the game logic modules have zero dependency on `runtime.ts`. They use dependency injection and can be copied directly.

| Category | Files | Lines |
|----------|-------|-------|
| Copy as-is (types, math, catalogs, all game logic modules) | 82 | ~40K |
| Minor adaptation needed (5 combat/monster cross-module files) | 5 | ~1.7K |
| Rewrite (wiring layer, IO/UI, platform, entry point) | 32 | ~25K |

The reusable files include everything in: `types/`, `math/`, `globals/`, `grid/`, `dijkstra/`, `architect/`, `combat/`, `game/`, `items/`, `monsters/`, `movement/`, `light/`, `time/`, `power/`, `state/`.

The rewrite is primarily the wiring layer (`runtime.ts`) and the IO/UI layer (`io/`, `menus/`, `platform/`).

---

## Architecture

### The Wiring Layer (replaces `runtime.ts`)

Instead of one monolith, the wiring is split into domain files at `rogue-ts/src/`. Each file provides context builder functions (`buildXxxContext()`) for one domain and closes over the shared mutable state in `core.ts`.

| File | Responsibility | Size target |
|------|---------------|-------------|
| `core.ts` | Shared mutable state, game lifecycle (init, gameOver, levelUp) | ~500 lines |
| `turn.ts` | buildTurnProcessingContext, buildMonstersTurnContext | ~500 lines |
| `combat.ts` | buildCombatContext, buildCombatDamageContext | ~400 lines |
| `monsters.ts` | buildMonsterSpawningContext, buildMonsterStateContext | ~400 lines |
| `items.ts` | buildItemHandlerContext, buildItemHelperContext | ~400 lines |
| `movement.ts` | buildMovementContext, buildTravelContext, buildTargetingContext | ~400 lines |
| `ui.ts` | buildDisplayContext, buildMessageContext, buildInventoryContext | ~400 lines |
| `platform.ts` | Async/sync bridge, browser event handling, main game loop | ~400 lines |

### The Async Bridge

The C game blocks on `getEvent()`. Browsers can't block. Every blocking C call maps to one of two patterns — and this mapping must be consistent everywhere:

- **Waiting for input:** `await platform.waitForEvent()` — true async. Used in the main game loop and any dialog that suspends until player responds.
- **Checking input:** `platform.peekEvent()` — non-blocking. Only valid when the caller guarantees the queue is non-empty (e.g., during playback). **Never** used as a fallback for waiting.

If a ported C function has a blocking call deep in its logic, that function must be made `async` and the blocking call replaced with `await waitForEvent()`. There is no synchronous fallback.

### Context Window Strategy

Before starting any session:
- Read the active initiative's BRIEF.md, PLAN.md, TASKS.md (3 files, ~1-2 min)
- Load only the files directly relevant to the current task
- If a bug requires understanding a system you're not working on, read its context builder file — not `core.ts` and everything else

Sessions should touch at most 2-3 source files. If a task feels like it requires loading 5+ files, split it into smaller tasks.

### Integration Tests

Every domain file gets at least one integration test before it's considered done. Integration tests exercise the full call chain — not just the context builder in isolation, but a realistic game state flowing through the actual ported function.

Key integration tests (written as part of the wiring phase, not after):
- Turn cycle: `playerTurnEnded()` with 3 monsters including one that dies mid-turn
- Combat: player attacks monster, monster dies, drops item, is removed from scheduler
- Item use: player drinks a potion, effect applies, turn advances, monsters move
- Level transition: player descends, new level generates, monsters have valid tick state

---

## Initiative Map

| Initiative | What | When |
|-----------|------|------|
| `port-v2-scaffold` | New `rogue-ts/` folder, copy reusable files, compile, tests pass | First |
| `port-v2-wiring` | Domain-split context builders + integration tests | Second |
| `port-v2-platform` | IO/UI layer, browser platform, menus, full game loop | Third |

Only one initiative is active at a time. An initiative is not done until all its tasks are checked off and there are no `test.skip` items without documented stubs.

---

## Reference

- First attempt retrospective: `docs/FIRST_PORT_ANALYSIS.md`
- Agent workflow: `.context/PROTOCOL.md`
- First attempt source (preserved): `ts/`
- C source (ground truth): `src/brogue/`
