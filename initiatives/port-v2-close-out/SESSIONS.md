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
