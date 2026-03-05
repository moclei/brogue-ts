# BrogueCE TypeScript Port — First Attempt Analysis

**Date:** 2026-03-04
**Scope:** Five days of AI-assisted porting, resulting in a playable browser game with ~67K lines of TypeScript and 2,264 passing tests.
**Purpose:** Assess what we learned and what a better-structured second attempt would look like.

---

## 1. What Was Done

The port followed a phased plan documented in `initiatives/typescript-port/PLAN.md`. The approach was bottom-up: types and math first, then data catalogs, then game logic modules (combat, monsters, items, movement), then UI and platform, then integration. This ordering was sound in principle.

Execution was AI-driven with minimal oversight between check-ins. The work proceeded quickly through a "stubs-first, wire-later" strategy: get everything compiling with placeholder implementations, then replace stubs with real logic in a second pass (documented as the `stub-completion` initiative). By day 3 the game could load; by day 5 it was playable enough to test.

**Numbers:**
- 119 TypeScript source files, ~67K lines
- 2,264 unit tests, all passing
- ~50 stubs/TODOs remaining in the codebase (catalogued in `docs/STUBS_SNAPSHOT.md`)
- 1 file accounts for 13% of all code: `runtime.ts` at 8,456 lines

---

## 2. What Went Well

**The module directory structure.** Organizing source into `combat/`, `monsters/`, `items/`, `movement/`, `time/`, `io/`, `globals/` etc. closely mirrors the C file organization and makes it straightforward to find where a given piece of logic lives. This was a good instinct.

**TypeScript type safety.** Defining precise interfaces for every context object (`TurnProcessingContext`, `CombatDamageContext`, etc.) caught a significant class of errors at compile time rather than at runtime. The `satisfies` keyword on large context objects provided extra safety.

**The dependency injection (DI) pattern.** Having functions receive a context object rather than reading global state made the ported modules individually testable. This is why we have 2,264 tests. The pattern itself is correct.

**The test suite.** 2,264 passing tests are valuable. Unit tests for individual ported functions caught many porting errors immediately. They also serve as executable documentation — you can read a test to understand what a function is supposed to do without reading the C source.

**The STUBS_SNAPSHOT.md document.** Whoever wrote this created a useful reference: a prioritized catalogue of what isn't working yet, with severity ratings. This kind of living document is worth carrying into any future work.

**Phase ordering.** Starting with types, then math/RNG, then data catalogs, then game logic was correct. The build order matched the dependency graph.

---

## 3. What Went Wrong

### 3a. The Monolith: `runtime.ts`

This is the single biggest structural problem. `runtime.ts` is 8,456 lines and contains every `buildXxxContext()` function — roughly 20+ context builders, the main game loop, shared mutable game state, and the browser event handler. It exists because all context builders need to close over the same mutable variables (`player`, `rogue`, `pmap`, `monsters`, etc.), and the simplest place to put them all was one file.

The consequences:

- **Every bug investigation touches `runtime.ts`.** It doesn't matter whether the bug is in combat, monster AI, item handling, or turn scheduling — the context builder for that system is in `runtime.ts`, so you have to load it. This is the primary driver of context window exhaustion.
- **Changes in one part affect all parts.** A function added to `buildCombatContext` sits near functions for `buildItemContext`, `buildMonsterContext`, and `buildTurnContext`. There is no encapsulation boundary.
- **It can never be read in one sitting.** At 8,456 lines, it exceeds any practical working memory, human or AI.

### 3b. Stubs Without Accounting

The stubs-first strategy was pragmatic — it let the build proceed before every system was implemented. But stubs that aren't systematically tracked become invisible technical debt. In this port:

- Some stubs were filled during the stub-completion phase.
- Others were added during stub-completion and never documented.
- Some stubs have the right function signature but wrong behavior (the "simplified" category in STUBS_SNAPSHOT — arguably more dangerous than a silent no-op because they appear to work).
- There is no single file an AI session can read to quickly understand "what is actually working vs. not."

The STUBS_SNAPSHOT.md helps but was created after the fact and isn't linked into any build process. If you add a stub at 2am, nothing reminds you to document it.

### 3c. Lost Call-Ordering Assumptions

Two of the first playtest bugs illustrate this class of problem:

**Bug:** Dying monsters were included in the turn scheduler's `soonestTurn` calculation. Their `ticksUntilTurn` went increasingly negative each iteration because `monstersTurn()` returns early for `MB_IS_DYING` without resetting the counter. This made the scheduler run tens of wasted iterations per player turn, and made scroll effects appear delayed.

**Root cause:** In the C code, the monster list cleanup (`removeDeadMonsters`) is almost certainly called with different timing — possibly within the inner turn loop, or the C linked-list traversal inherently skips dead monsters differently. When the turn-processing loop was ported as an isolated unit, the exact calling convention of cleanup relative to the loop was not captured.

This is a category of bug that unit tests won't catch. You can unit-test `monstersTurn()` perfectly and still miss this. It only surfaces when you run a full `playerTurnEnded()` cycle with a monster that dies mid-turn.

**Pattern:** When a ported function depends on specific calling order from its surroundings (cleanup timing, flag state, list mutation), that dependency needs to be captured either in an integration test or an explicit code comment. Porting functions individually without testing them in their actual call context leaves these gaps.

### 3d. The Async/Sync Impedance Mismatch

The C game is synchronous: it calls `getEvent()` and blocks. Browsers can't block the main thread, so every event-waiting call had to become `async/await`. This transformation was done mechanically — the ported C input loops (`mainInputLoop`, `moveCursor`, etc.) call synchronous event functions (`nextKeyOrMouseEvent`) which return an error code immediately when the queue is empty.

The result: any C code path that expected blocking now either spins (freezing the browser tab) or returns immediately (skipping the action). The mouse-click deadlock was exactly this: a synchronous spin loop that worked in C but froze the browser.

This problem is inherent to browser porting. But it wasn't identified, documented, and solved as a first principle at the start. Instead, each occurrence of it was discovered and fixed ad hoc. There is no single document that says "here is how blocking C calls are handled in this codebase" — you have to read multiple files and piece it together.

### 3e. No Integration Tests

The 2,264 tests are unit tests. They test individual functions with controlled inputs. There are no tests that:
- Run a full `playerTurnEnded()` cycle with a realistic game state
- Verify that a player moving one step produces the correct game state afterward
- Check that a monster killed during combat is removed from the scheduler properly

These integration tests would have caught the `soonestTurn` bug before any playtesting. Writing them after the fact is harder than writing them alongside the original port.

---

## 4. Key Learnings

### L1: The monolith is the root cause of the workflow problem.

It's not the size of the codebase. It's not the complexity of Brogue. It's that one file — `runtime.ts` — contains everything that every bug investigation needs. Splitting it into domain-specific files is the single highest-leverage structural change possible.

### L2: Stubs need a contract, not just a comment.

A stub that says `/* stub */` is invisible. A stub that has a corresponding entry in a tracked file, with impact level, expected behavior, and test criteria, is manageable. The rule should be: **if you create a stub, you also create a test that will fail until the stub is replaced.** This makes stubs self-reporting.

### L3: Port the call context, not just the function.

When porting a function that has ordering dependencies (cleanup timing, state that must be set before calling, side effects that must happen after), capture those dependencies explicitly. Either as an integration test that exercises the function in its real context, or as code comments at the call site.

### L4: The async/sync wrapper needs to be a first-class design decision.

Every blocking C call maps to one of a small number of patterns in async TypeScript:
- `waitForEvent()` → proper async wait (correct)
- `nextKeyOrMouseEvent()` → synchronous queue peek (only valid if queue is guaranteed non-empty)
- Spin loops → must be replaced with async loops

This mapping should be written down before porting begins and referenced by every session that touches event handling.

### L5: Integration tests are cheaper than playtesting.

A 15-minute playtesting session that finds one bug takes as long as writing 10 integration tests that would find the same bug automatically. The payoff compounds: tests run on every change, playtesting doesn't.

---

## 5. If Starting Over: What Would Be Different

### Architecture

**Split context builders by domain from the start.** Instead of one `runtime.ts`, create:

```
src/
  runtime/
    runtime-core.ts       # Main game loop, shared state, entry point (~600 lines max)
    runtime-turn.ts       # buildTurnProcessingContext, buildMonstersTurnContext
    runtime-combat.ts     # buildCombatContext, buildCombatDamageContext
    runtime-monsters.ts   # buildMonstersTurnContext, monster-specific builders
    runtime-items.ts      # buildItemHandlerContext, item-specific builders
    runtime-movement.ts   # buildMovementContext, buildTravelContext
    runtime-ui.ts         # buildDisplayContext, buildMessageContext, buildInventoryContext
    runtime-platform.ts   # Browser event handling, input dispatch, async/sync bridge
```

Each file stays under 600-800 lines. A bug in combat only requires loading `runtime-combat.ts` + the combat module, not 8,456 lines.

The shared mutable state (`player`, `rogue`, `pmap`, etc.) lives in `runtime-core.ts` and is imported by the others. This is cleaner than closures over local variables.

**No stubs without tracking.** A `STUBS.md` file at the project root is updated every time a stub is created. It's checked in CI (a test that counts stubs and fails if the count increases without a corresponding entry). Format:

```markdown
| Function | File | Line | Impact | Test to pass when done |
|----------|------|------|--------|------------------------|
| `throwCommand` | runtime-items.ts | 42 | High — player can't throw | `player-throw.test.ts: "throwing a dagger damages monster"` |
```

**Async bridge documented first.** Before any game logic is ported, write `ASYNC_BRIDGE.md` documenting every C blocking call and its TypeScript equivalent. Every session that touches event handling reads this first.

### Porting Methodology

**One subsystem at a time, fully.** Do not proceed from subsystem N to N+1 until:
1. All functions in subsystem N are implemented (no stubs)
2. Unit tests pass
3. At least one integration test exercises the subsystem in its real call context
4. A 1-paragraph review of the C source confirms no structural differences were missed (removeDeadMonsters timing, etc.)

**Recommended subsystem order** (revised from original, stricter about completion criteria):
1. Types + Math + RNG — fully tested, deterministic output validated
2. Data catalogs (monster catalog, item tables, dungeon features) — read-only, easy to validate
3. Grid + Dijkstra — foundational, well-defined interfaces
4. Combat (attack, damage, death) — *including* the death cleanup sequence and integration test
5. Monster creation + basic state — *including* monster turn scheduler with dying-monster test
6. Player movement + turn processing — *including* full `playerTurnEnded` integration test
7. Items (apply, effects) — *including* item-use cycle test
8. Level generation (architect) — seed validation
9. UI (display, inventory, messages) — last because it's mostly additive

**Each session targets one subsystem.** A session that says "do combat today" means: read the C combat source, port the functions, write the tests, verify no stubs remain. Not "port some combat functions and stub the rest for later."

### Context Window Optimization

This is the specific challenge of AI-assisted porting of a large codebase.

**Keep files small.** The 600-line heuristic is right. Every file should be readable in a single context load. If a file exceeds this, split it — the split will usually reveal a natural domain boundary anyway.

**Interface files as contracts.** Define TypeScript interfaces for every context object in a separate `*-context.ts` file. When fixing a bug, you often only need the interface, not the implementation. This lets you load 3 small files (interface + two implementations) instead of one large file.

**Integration tests as specifications.** A well-written test for `playerTurnEnded` with a dying monster in the monster list is more useful context than reading 500 lines of `turn-processing.ts`. Tests are compact, they tell you exactly what the expected behavior is, and they run fast.

**MEMORY.md / session context.** (This already exists in the Claude Code workspace.) Keep it updated with: which subsystems are complete, which are stubbed, known structural differences from C, the async bridge map. This is the file that prevents re-deriving the same context at the start of each session.

**Subsystem-scoped sessions.** Structure sessions so each one touches at most 2-3 source files. "Fix the bug in turn processing" becomes two steps: (1) a short session that reads turn-processing.ts + runtime-turn.ts and diagnoses the bug, (2) a second session that fixes it and writes the test. Each session is under the context budget.

---

## 6. Assessment: Continue or Restart?

This analysis suggests the existing port has two separable problems:

**Problem A (fixable without restart):** The runtime.ts monolith and missing integration tests. These can be addressed by refactoring and writing tests — probably 1-2 days of focused work. After that, the workflow improves significantly.

**Problem B (requires restart to fix cleanly):** Accumulated behavioral drift in the ~50 remaining stubs, plus call-ordering assumptions that weren't captured. These can be fixed iteratively through playtesting + targeted fixes, but each fix requires deep investigation.

**The restart argument:** Five days of work is not a sunk cost large enough to be trapped by. A restart with the above methodology — strict phase completion, no undocumented stubs, integration tests alongside porting, domain-split runtime files — would likely reach the current level of functionality in similar time but with a much cleaner foundation. The remaining 50 stubs would be addressed as part of the porting process rather than as a separate phase of bug-hunting.

**The continue argument:** The game is playable. The bugs being found are localized and understandable. The test suite is valuable and shouldn't be thrown away. A refactor of `runtime.ts` into domain files (purely mechanical, no logic changes) plus targeted integration tests for the highest-risk paths (turn scheduling, combat → death, item effects) would recover most of the benefits of a restart without starting from zero.

**Recommendation:** Make the decision based on one diagnostic question — **how clean is the core turn loop?** The turn-processing, combat, and monster-death sequence is the heart of the game. If we can write a comprehensive integration test suite for that cycle and it passes (or the failures are small and understandable), then continuing is the right call. If the integration tests reveal widespread behavioral drift, restart.

That test suite can be written in a day and will give a definitive answer.

---

## 7. Appendix: Files to Read First in Any Session

When debugging any issue, these are the files most likely needed. Listed in order of how often they're relevant:

| File | Size | What's In It |
|------|------|-------------|
| `runtime.ts` | 8,456 | All context builders — every session needs this currently |
| `time/turn-processing.ts` | 858 | `playerTurnEnded` — core game loop |
| `combat/combat-damage.ts` | ~600 | `inflictDamage`, `killCreature` |
| `monsters/monster-actions.ts` | 1,228 | `monstersTurn` |
| `io/io-input.ts` | 1,875 | Key/mouse input dispatch |
| `movement/travel-explore.ts` | 901 | Mouse-click travel |
| `game/game-cleanup.ts` | ~200 | `removeDeadMonsters` |

After a `runtime.ts` split, this list would become domain-specific — a combat bug would only need `runtime-combat.ts` + `combat-damage.ts`, not the full 8,456 lines.
