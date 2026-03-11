# PLAN: port-v2-close-out

## Session Protocol

**One phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked phase.
2. Complete that phase only. Do not start the next phase.
3. **Stop at 60% context window usage** — even if the phase is not finished.
   Commit partial progress, note where you stopped in TASKS.md, generate a handoff.
4. Run `npx vitest run` before committing. Fix any regressions.
5. Commit all changes.
6. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact phase/task name from TASKS.md]
   Branch: feat/port-v2-playtest
   Last commit: [hash]
   ```
   Add a `## Session Notes [date]` section to PLAN.md only if there are decisions
   or findings worth preserving across sessions.

**Do not start a new phase to fill remaining context. Stop, commit, hand off.**

---

## Phase 1: Archive + wire throw/call dialogs

**Goal:** Consolidate stale initiatives; wire throwCommand and inscribeItem which are
already fully implemented but not yet connected to their context builder stubs.

Archiving is purely file moves and note additions — no code changes. Wiring throw/call
is straightforward: implementations exist from verify-mechanics, stubs just need replacing.

**After this phase:** throw dialog shows targeting cursor; call/inscribe dialog shows
text input prompt.

---

## Phase 2: waitForAcknowledgment + confirm async cascade

**Goal:** --MORE-- blocks until keypress; dangerous terrain shows confirm prompt before
the player steps onto it.

These are the most complex changes in this initiative because they require async cascades
— calling functions need to become async, which can ripple up the call chain.

**Before writing any code:** read the full call chain for each. Map every function
that needs to become async. If the combined cascade is too large for one session,
do `waitForAcknowledgment` first and move `confirm` to its own sub-session.

Work method: trace the chain in src/ before touching anything. Smaller, contained
changes are better than a large refactor.

**After this phase:** player sees --MORE-- prompts that block for input; walking toward
lava or open traps shows a "Really step onto X?" warning before acting.

---

## Phase 3: Remaining wireable stubs

**Goal:** Close all remaining wireable non-persistence stubs.

**Wiring only — do not port any new functions in this phase.**

For each candidate stub: find the real implementation in src/, replace the `() => {}`
or `() => false` stub, activate or update the paired test.skip. If no implementation
exists, update the comment to explain the gap clearly and move on.

Work from a grep of `// stub` across src/ — any `// stub — wired in port-v2-platform`
entries that still have no real impl should be retagged with a permanent-defer note.

**After this phase:** all wireable stubs closed; remaining test.skips are either
persistence-deferred or permanently acceptable simplifications.

---

## Phase 4: Light.c audit

**Goal:** Verify the 5 NEEDS-VERIFICATION lighting functions match C source.

Reference: `docs/audit/gaps-Light.md` — read this first to identify the 5 functions.

Lighting correctness matters for fog of war and cell visibility. Errors here can cause
silent gameplay differences (cells showing as visible that shouldn't be, or vice versa).

For each function:
1. Read C source in `src/brogue/Light.c`
2. Read the TS port
3. Confirm match, document divergence, or fix
4. Add a direct unit test if none exists; add test.skip with description if divergence
   is acceptable but worth noting

**After this phase:** all 5 light functions verified against C source; any bugs fixed.

---

## Phase 5: Browser playtest

**Goal:** Verify all newly wired stubs work in-browser; catch any regressions from
Phases 1–4.

Uses the same SESSIONS.md workflow from port-v2-playtest Phase 8.

Focus areas (from newly wired work):
- Throw a potion or fire a wand — targeting cursor appears; item uses on confirmation
- Call an item — text input prompt appears; item gets the new name
- Fill the message log — `--MORE--` appears and blocks until keypress
- Walk toward lava or an open trap — confirm prompt appears before stepping
- Lighting / fog of war looks correct (Light.c fixes)

Each session in Phase 5:
1. Read SESSIONS.md — Bug Tracker first, then last session entry
2. Pick highest-priority open bug, or work through the focus area checklist
3. Stop at ~60% context window; update SESSIONS.md; commit; generate handoff

Phase 5 is complete when all focus areas are checked or have a clear documented
reason they cannot yet be verified.

---

## Phase 6: Final cleanup

**Goal:** Docs updated, initiative Phases 1–5 marked complete, Phase 7 handed off.

No code changes. Update MEMORY.md and PROJECT.md to reflect that backlog work
continues in Phase 7 via `docs/BACKLOG.md`. No longer closes out to port-v2-persistence
directly — that layer will be reached after the backlog is clear.

---

## Phase 7: Backlog clearance (ongoing, no end date)

**Goal:** Implement everything in `docs/BACKLOG.md` except the persistence section.

`docs/BACKLOG.md` is the source of truth. This plan phase just describes the approach:
one item per session, highest priority first, same commit/handoff discipline as all
other phases. When the backlog non-persistence items are all checked off, move to the
persistence layer as a coordinated group effort.

See `docs/BACKLOG.md` for the full item list, complexity estimates, and session protocol.

---

## Known risks

- **Async cascade depth (Phase 2):** `confirm` in PlayerMoveContext is sync today.
  The cascade to make it async may touch more files than expected. If it is deeper
  than 3 function levels, treat as a separate sub-session.

- **throwCommand wiring complexity (Phase 1):** `chooseTarget` returns `Promise<{confirmed, target}>`.
  The ItemHandlerContext slot and its callers need to match that signature exactly.
  Check `items.ts` and `ui.ts` both — there may be two separate stub sites.

- **Light.c scope (Phase 4):** If `docs/audit/gaps-Light.md` lists fewer than 5 functions
  or the file doesn't exist, check `docs/audit/` for the correct gap file name.

---

## Session Notes 2026-03-10

**Phase 2a: waitForAcknowledgment — DONE.** Made 6 message functions async in messages.ts.
Wired real `waitForAcknowledgment` in `buildMessageContext()` using `waitForEvent()` loop.
Cascaded `playerTurnEnded()` async through all callers (13 files): turn.ts, movement.ts,
player-movement.ts, input-context.ts (3 closures), input-dispatch.ts, inventory-actions.ts,
items.ts, misc-helpers.ts. `autoRest()`/`manualSearch()` → async. Tests fixed with await.
Key learning: `playerTurnEnded` cascade was manageable because domain functions with
REQUIRE_ACKNOWLEDGMENT messages (hunger, levitation) are mostly stubs in current wiring.
Only 3 direct REQUIRE_ACKNOWLEDGMENT awaits needed in turn-processing.ts.

**Next session start point:** Phase 3 — remaining wireable stubs.

---

## Session Notes 2026-03-09

**Phase 2b: confirm — DONE.** Created `buildConfirmFn()` in `io-wiring.ts` using
`printTextBox` + `buildInventoryContext()` for a real Yes/No dialog. Cascaded:
`playerMoves`/`playerRuns` → async; `eat`/`drinkPotion`/`readScroll` → async;
`travel-explore.ts` callers → await; `input-context.ts`/`input-dispatch.ts` updated.
Both movement.ts and items.ts stubs replaced. 2 test.skips activated (+2 pass, -2 skip).

**Phase 2a: waitForAcknowledgment — DEFERRED.** Cascade is 5+ levels deep: the chain
goes `waitForAcknowledgment → displayMoreSign/temporaryMessage → message → messageWithColor
→ displayCombatText → combatMessage → buildMessageFns() → every context builder's message
slots → all domain functions calling ctx.message(...)`. Too wide for one session. Start
fresh with the cascade analysis in TASKS.md as the guide.

**Next session start point:** Phase 2a sub-session — waitForAcknowledgment.
The cascade analysis is documented in TASKS.md Phase 2a block.
The key decision: make message() async; add await to all ctx.message() calls in
domain functions (playerMoves is already async — that part is done).
