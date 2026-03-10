# SESSIONS: port-v2-close-out — Phase 5 Browser Playtest

Each session finds bugs, fixes them, and updates this file.
New sessions: read the Bug Tracker table first, then the last session entry.

---

## Bug Tracker

| ID | Description | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| B1 | --MORE-- never appears when message log fills | P1 | OPEN | Phase 2a wired waitForAcknowledgment; display/render step may not be firing |
| B2 | Item not removed from inventory after throwing | P1 | FIXED | buildThrowCommandFn: added packItems destructure + removeItemFromArray after throwItem returns |
| B3 | "Call" label shows "Relabel" for unidentified items | P2 | FIXED | ui.ts actionButtons missing CALL_KEY button; added with itemCanBeCalled guard |
| B4 | Fog ghost — picked-up item stays visible under fog of war | P3 | OPEN | Dungeon memory not updated on item pickup; clears on direct LOS |
| B5 | "Call" dialog does nothing — keystrokes fall through to game | P2 | FIXED | asyncGetInputTextString in item-commands.ts; inscribeItem made async; tests updated |

---

## Session Log

### Session 1 — 2026-03-10

**Playtest findings (first session):**
- Throw mechanic works for most potions; one caused a hang (suspected effect bug, not throw mechanic)
- Item not removed from inventory after throw (B2) — fixed
- "Call" option missing for unidentified items, only "Relabel" shown (B3) — fixed
- --MORE-- never appeared when messages filled (B1) — open, needs investigation
- Fog ghost: picked-up items stay visible under fog until direct LOS (B4) — open

**Fixes this session:**
- B2: `item-commands.ts` — added `packItems` to `getGameState()` destructure; after `throwItem` returns, decrement `item.quantity` or `removeItemFromArray(item, packItems)`. Mirrors C throwCommand:6379.
- B3: `ui.ts` — added `CALL_KEY` to constants import, imported `itemCanBeCalled`; added call button to `actionButtons` when `itemCanBeCalled(theItem)` is true.

**Open bugs:** B1 (--MORE--), B4 (fog ghost)

**State at end:** 88 files, 2242 pass, 82 skip — no regressions.

---

### Session 2 — 2026-03-10

**B1 analysis (--MORE-- never appears):**
- Code traced: `displayMoreSign` writes to buffer; `waitForAcknowledgment` calls `commitDraws()` before waiting — logic is correct.
- --MORE-- only fires for `REQUIRE_ACKNOWLEDGMENT` flag (hunger, traps, etc.) or `cautiousMode` (never set — commented out in C too).
- Title "when message log fills" is misleading: Brogue does NOT show --MORE-- on log overflow, only for specific flagged messages.
- Likely explanation: tester never generated a REQUIRE_ACKNOWLEDGMENT message in their short playtest.
- To re-test: play until hunger warning fires (≥1500 turns), or step on a trap.
- One remaining risk: `refreshDungeonCell` stub (no-op) — if a LONG message triggers the else branch of displayMoreSign (--MORE-- placed at row MESSAGE_LINES), cells won't be restored after ack. Visual glitch, not a blocking issue.

**B5 fixed:**
- `item-call.ts`: made `inscribeItem` async; `InscribeContext.getInputTextString` now returns `string | null | Promise<string | null>`.
- `item-commands.ts`: added `asyncGetInputTextString` — clears message area, shows prompt, loops with `waitForEvent()` reading printable ASCII chars, DELETE/backspace, RETURN (confirm), ESCAPE (cancel); matches C IO.c:2720 non-dialog mode.
- Wired in `buildCallCommandFn`: replaced `() => null` stub with `asyncGetInputTextString`; added `await` to `playerTurnEndedFn()`.
- Tests (`item-call.test.ts`): all `it()` callbacks made async, all `inscribeItem()` calls awaited.

**Open bugs:** B1 (--MORE-- — needs further in-game testing), B4 (fog ghost)

**State at end:** 88 files, 2242 pass, 82 skip — no regressions.
