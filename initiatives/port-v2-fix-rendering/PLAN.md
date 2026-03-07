# PLAN: port-v2-fix-rendering

## Session Protocol

**One sub-phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked task.
2. Complete that task only. Do not continue into the next task.
3. Commit. Update TASKS.md (check off completed tasks).
4. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-fix-rendering. Read: .context/PROJECT.md, initiatives/port-v2-fix-rendering/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact task name from TASKS.md]
   Branch: feat/port-v2-fix-rendering
   ```
   Add a `## Session Notes [date]` to PLAN.md only if there are decisions worth preserving.

Stop at 60% context. Do not start a new task to fill remaining context.

---

## Approach

Work phase-by-phase in fix-priority order. Each sub-phase ends with a commit. Do not start the
next sub-phase until the current one is committed and TASKS.md is updated.

The C source in `src/brogue/` is ground truth for all implementations. The audit gap files
(`docs/audit/gaps-*.md`) are the reference for what is missing and what is already stubbed.

---

## Phase 1 — Rendering blockers

**Files:** `rogue-ts/src/io/display.ts`, `rogue-ts/src/lifecycle.ts`

**Functions to implement:**
1. `getCellAppearance` (IO.c ~line 1) — computes the visual appearance of a dungeon cell. Inputs:
   grid coordinates + game state. Output: glyph, foreground color, background color. The C
   implementation handles terrain, items, monsters, lighting, and visibility state. This is the
   most complex function in Phase 1.
2. `refreshDungeonCell` (IO.c) — calls `getCellAppearance` then writes to the display buffer via
   `plotCharWithColor`. Wired into movement.ts and ui.ts contexts.
3. `displayLevel` (IO.c) — loops over all cells and calls `refreshDungeonCell`. Remove the stub
   in `lifecycle.ts:479` and add the real implementation. Add the test.skip to ui.test.ts or
   lifecycle.test.ts if not already present.

**Approach:** implement bottom-up: `getCellAppearance` first (domain logic, no side effects),
then `refreshDungeonCell` (calls getCellAppearance + plotCharWithColor), then `displayLevel`
(loops over map). Test each in isolation before wiring.

---

## Phase 2 — Runtime crash fix

**File:** `rogue-ts/src/lifecycle.ts` (game-lifecycle context builder)

**Problem:** `saveRecording` is declared in the context interface and called at
`game-lifecycle.ts:378` and `game-lifecycle.ts:596`, but no implementation is wired in. This
causes a runtime crash at game end.

**Fix:** Add a no-op stub `saveRecording: () => {}` to the context builder until the persistence
layer is built. Track it with a `test.skip`. Do not implement recording I/O — that is
OUT-OF-SCOPE.

---

## Phase 3 — Item system

**File:** `rogue-ts/src/items.ts` (and supporting files as needed)

**Reference:** `docs/audit/gaps-Items.md` — 28 MISSING + 12 STUBBED-UNTRACKED functions.

**Priority sub-order:**
1. `displayInventory` — inventory UI (blocks all item interaction)
2. `updateFloorItems` — per-turn item tick (fungal spread, etc.)
3. `itemIsCarried`, `itemQuantity` — utility functions used by use/drop flow
4. `identify` / `use` / `drop` flow functions
5. Individual item effects: `applyTunnelEffect`, `teleport`, `negationBlast`, `empowerMonster`,
   `magicChargeItem`, remaining potion/scroll/wand effects

**Note:** Each implemented function removes a `test.skip`. If a function requires a new helper,
add the helper in the same file (600-line limit applies — split if needed).

---

## Phase 4 — Monster AI

**File:** `rogue-ts/src/monsters.ts` (and supporting files as needed)

**Reference:** `docs/audit/gaps-Monsters.md` — 27 MISSING functions.

**Priority sub-order:**
1. `monsterCastSpell` — top-level spell dispatch
2. `monstUseBolt` — bolt-casting pipeline
3. Ability functions: `monstUseDomination`, `monstUseBeckon`, `monstUseBlinkAway`
4. Summon functions, polymorph, fear, confusion AI
5. `monsterDetails` — sidebar monster description

---

## Phase 5 — NEEDS-VERIFICATION review

**Reference:** `docs/audit/summary.md` — NEEDS-VERIFICATION table (139 functions).

**Approach:** Manual review, file by file. For each function: read C source, read TS port, note
any behavioral divergence. Fixes go into the appropriate source file. Divergences that are not
immediately fixable get a `test.skip` with a description.

**Priority:** Monsters.c (20 — highest risk of silent simplification) → PowerTables.c (15
unwired) → RogueMain.c (20) → rest.

---

## Rejected Approaches

- Implementing `saveRecording` with real file I/O: persistence layer is not planned — stub only.
- Batch-implementing all Items.c functions in one session: too large; sub-ordered for incremental progress.

## Open Questions

- Does `getCellAppearance` require the lighting system to be fully functional first, or can it
  fall back to unlit appearance? (Check IO.c implementation before starting Phase 1.)
- Are any of the 15 unwired PowerTables.c functions reachable from current item code paths,
  or are they all blocked by MISSING Items.c functions?
