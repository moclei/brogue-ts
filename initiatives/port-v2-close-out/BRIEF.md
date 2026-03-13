# Port V2 — Close Out

## Intent

Complete the final wiring work for the TypeScript port of Brogue. All non-persistence
stubs wired to real implementations, remaining context builder gaps closed, deferred
items documented clearly, and prior initiatives formally consolidated.

This initiative picks up directly from port-v2-playtest (Phase 9b done, all known
gameplay bugs fixed). It is not a porting initiative — it is a wiring and verification
sprint. No new C functions should need to be ported; all implementations exist in src/.

## Goals

- Wire all remaining non-persistence stubs (~15–20 wireable context slots)
- `waitForAcknowledgment` (--MORE-- prompt) wired and functional
- `confirm` in movement contexts wired (dangerous terrain warning dialogs)
- `throwCommand` and `call`/`inscribeItem` dialogs wired to their implementations
- `discoveredTerrainFlagsAtLoc` wired in all 3 context builders (turn.ts, monsters.ts, lifecycle.ts)
- Light.c NEEDS-VERIFICATION audit complete (5 functions)
- Browser playtest: all newly wired features verified in-browser
- All prior initiatives consolidated or archived
- All remaining test.skip entries classified: ACTIVE / PERMANENT-DEFER / PERSISTENCE-DEFER

## Scope

What's in:
- Archive stale completed initiatives (port-v2-domain-gaps, port-v2-platform,
  port-v2-fix-rendering, port-v2-verify-mechanics)
- Wire ~15–20 existing implementations into context builder stubs
- Async cascade for waitForAcknowledgment and confirm
- Light.c audit (5 functions — verify or fix each)
- Browser playtest pass + bug fixes via SESSIONS.md workflow

What's out (explicitly deferred to port-v2-persistence):
- save/load (.broguesave), recording/playback (.broguerec)
- High scores, level revisit (restoreItems/restoreMonster)
- All stubs already tagged `// DEFER: port-v2-persistence` — do not touch

## Prerequisites

- port-v2-playtest Phases 1–9b all complete ✓ (including Phase 9b-6)
- 87 files, 2220 pass, 86 skip as of initiative start
- Branch: feat/port-v2-playtest (continue on this branch)

## Key source locations

- Stub sites: rogue-ts/tests/ (test.skip entries); rogue-ts/src/ (`// stub` comments)
- Context builders: src/movement.ts, src/items.ts, src/combat.ts, src/turn.ts,
  src/monsters.ts, src/lifecycle.ts, src/ui.ts, src/io/input-context.ts
- chooseTarget / hiliteTrajectory: src/items/targeting.ts (verify-mechanics Phase 1d)
- inscribeItem / itemCanBeCalled: src/items/ (verify-mechanics Phase 1b)
- Async event bridge: src/platform.ts, src/io/input-keystrokes.ts, src/io/input-dispatch.ts
- discoveredTerrainFlagsAtLoc domain fn: src/state/helpers.ts (verified correct)
- Light audit reference: docs/audit/gaps-Light.md
