# Audit: RogueMain.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured only 6 static functions. Supplemented with a public-function
grep pass to find 16 additional functions. Total: 22 functions. TASKS.md estimated ~22 — exact match.

RogueMain.c is the top-level game orchestration file. It contains the C entry point (`rogueMain`),
all lifecycle hooks (`initializeRogue`, `startLevel`, `freeEverything`), the game-over / victory
sequences, and a collection of utility helpers (`fileExists`, `chooseFile`, `openFile`, `unflag`).

In the TS port this file's responsibilities are distributed across four modules:
- `game/game-init.ts` — version info, file helpers, game initialization
- `game/game-level.ts` — level setup (startLevel, updateColors)
- `game/game-cleanup.ts` — creature/memory cleanup
- `game/game-lifecycle.ts` + `core.ts` — gameOver, victory, enableEasyMode

This means **every function has a TS equivalent** — there are zero MISSING functions. However,
almost all are NEEDS-VERIFICATION because the domain functions are largely untested directly.
The sole IMPLEMENTED entry is `gameOver` (partially: `core.ts:gameOver` has 5 passing tests
covering the synchronous state-change phase, but `game/game-lifecycle.ts:gameOver` — the full
C port with death screen display — is untested).

Notable wiring stubs (context layer, not domain):
- `enableEasyMode: () => {}` at `io/input-context.ts:203` — no test.skip (UNTRACKED wiring stub)
- `executeEvent: () => {}` at `menus.ts:256` — no test.skip (UNTRACKED wiring stub)
- `openFile: () => false` at `menus.ts:264` — has test.skip at `menus/menus.test.ts:128` (tracked)

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| rogueMain | 33 | bootstrap.ts:91 | NEEDS-VERIFICATION | No `rogueMain` TS function; browser entry is `bootstrap.ts:main()` → `mainBrogueJunction()`; `previousGameSeed=0` init not verified |
| printBrogueVersion | 39 | game/game-init.ts:739 | NEEDS-VERIFICATION | Real impl (returns string rather than printf); no direct test |
| executeEvent | 45 | io/input-dispatch.ts:485 | NEEDS-VERIFICATION | Real async impl; called from input-cursor.ts:353; context stub at menus.ts:256 is untracked no-op |
| fileExists | 55 | game/game-init.ts:305 | NEEDS-VERIFICATION | Real impl delegating to ctx.fileExistsSync; no direct test |
| chooseFile | 68 | game/game-init.ts:316 | NEEDS-VERIFICATION | Real impl delegating to ctx.getInputTextString; no direct test |
| openFile | 89 | game/game-init.ts:353 | NEEDS-VERIFICATION | Real impl; context stub at menus.ts:264 (`() => false`) has test.skip at menus.test.ts:128; domain fn itself untested |
| screen_update_benchmark | 118 | — | OUT-OF-SCOPE | Debug performance benchmark; no browser equivalent needed |
| getOrdinalSuffix | 137 | game/game-init.ts:287 | NEEDS-VERIFICATION | Real impl; used internally at game-init.ts:429; no direct test |
| welcome | 157 | game/game-init.ts:420 | NEEDS-VERIFICATION | Real impl; calls ctx.message; no direct test |
| initializeGameVariant | 173 | lifecycle.ts:253 | NEEDS-VERIFICATION | Split into 3 TS functions (Brogue/RapidBrogue/BulletBrogue); menus.ts context is no-op stub (untracked); no direct tests for variant fns |
| initializeRogue | 190 | lifecycle.ts:519 | NEEDS-VERIFICATION | Thin wrapper calling initializeRogueFn(buildGameInitContext(), seed); domain logic in game/game-init.ts; no direct test |
| updateColors | 538 | game/game-level.ts:233 | NEEDS-VERIFICATION | Real impl (depth-dependent color interpolation); called from startLevel; no direct test |
| startLevel | 547 | lifecycle.ts:525 | NEEDS-VERIFICATION | Thin wrapper calling startLevelFn(buildLevelContext(), ...); used as context mock in time/creature-effects.test.ts; no direct domain test |
| freeGlobalDynamicGrid | 930 | — | OUT-OF-SCOPE | Internal static helper freeing C dynamic grids; GC handles equivalently in JS |
| freeCreature | 937 | game/game-cleanup.ts:100 | NEEDS-VERIFICATION | Real impl including recursive carriedMonster cleanup; no direct test |
| removeDeadMonstersFromList | 951 | game/game-cleanup.ts:125 | NEEDS-VERIFICATION | Private internal helper called by removeDeadMonsters; no direct test |
| removeDeadMonsters | 979 | game/game-cleanup.ts:120 | NEEDS-VERIFICATION | Real impl; used as context stub/mock in turn-processing tests; no direct domain test |
| freeEverything | 984 | lifecycle.ts:530 | NEEDS-VERIFICATION | Thin wrapper calling freeEverythingFn(buildCleanupContext()); no direct test |
| gameOver | 1046 | core.ts:289 + game/game-lifecycle.ts:201 | NEEDS-VERIFICATION | Split: core.ts covers sync state change (IMPLEMENTED, 5 tests in core.test.ts); game-lifecycle.ts covers full death screen sequence (untested) |
| victory | 1218 | game/game-lifecycle.ts:416 | NEEDS-VERIFICATION | Real impl; victory spy used as context mock in movement/travel-explore.test.ts; domain function itself untested |
| enableEasyMode | 1384 | game/game-lifecycle.ts:627 | NEEDS-VERIFICATION | Real impl; context stub at io/input-context.ts:203 (`() => {}`) is untracked (no test.skip); domain fn untested |
| unflag | 1406 | game/game-cleanup.ts:265 | NEEDS-VERIFICATION | Real impl (bit-flag inversion); no direct test |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 0 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 20 |
| OUT-OF-SCOPE | 2 |
| DATA-ONLY | 0 |
| **Total** | **22** |

## Critical Gaps

No MISSING or STUBBED functions. All 20 NEEDS-VERIFICATION items have real implementations.
Ordered by gameplay impact:

1. `initializeRogue` — game start entry point; lifecycle correctness is critical for every
   playthrough; the wrapper and domain function are both untested end-to-end.

2. `startLevel` — level transition entry point; any regression here breaks depth progression,
   which is the core gameplay loop.

3. `gameOver` (game-lifecycle.ts:201) — the full death sequence (display messages, inventory
   view loop, recording flush) is untested. The synchronous state change (`core.ts:289`) IS
   tested, but the display sequence may never fire correctly if `displayLevel` is still stubbed.

4. `victory` — the win condition is completely untested. `movement/travel-explore.test.ts`
   verifies that victory is *called* at the right time, but the victory display sequence itself
   is unverified.

5. `enableEasyMode` — context stub at `io/input-context.ts:203` is an untracked no-op, so the
   feature is silently disabled during normal play. Needs both a test.skip and eventual wiring.

6. `executeEvent` — context stub at `menus.ts:256` is an untracked no-op. In playback mode,
   replayed events would be silently swallowed. Needs a test.skip.

7. `freeCreature` / `removeDeadMonsters` / `freeEverything` — memory management chain is
   completely untested. In JS this is lower risk (GC prevents leaks), but object invariants
   (nulled references, list removal) are unverified.

## Notes for follow-on initiative

**RogueMain.c has zero MISSING functions** — every C function has a TS equivalent with real code.
The entire NEEDS-VERIFICATION backlog is a testing gap, not a porting gap.

**Two structural divergences from C that need human review:**
1. `rogueMain` → `bootstrap.ts:main()`: The browser entry point does significantly more
   (canvas setup, event loop initialization) than the 3-line C `rogueMain`. The
   `previousGameSeed = 0` initialization from the C entry point should be verified as
   equivalent in the TS lifecycle.
2. `gameOver` split: `core.ts:gameOver` (sync state) + `game/game-lifecycle.ts:gameOver`
   (full sequence). The C function is a single 172-line routine. The split is architecturally
   sound for async browser rendering, but it should be reviewed to confirm no logic fell
   through the gap between the two halves.

**Two untracked wiring stubs need test.skip entries (Phase 3 cleanup):**
- `enableEasyMode: () => {}` at `io/input-context.ts:203`
- `executeEvent: () => {}` at `menus.ts:256`

**Priority order for domain-level tests (follow-on test pass):**
1. `initializeRogue` + `startLevel` — lifecycle entry points, test against seed-determinism expectations
2. `gameOver` (game-lifecycle.ts:201) — full death sequence; blocked by `displayLevel` stub
3. `victory` (game/game-lifecycle.ts:416) — win condition sequence; same display dependency
4. `freeCreature` + `removeDeadMonsters` — object invariants after cleanup (low risk but untested)
5. `updateColors` + `welcome` + `getOrdinalSuffix` — utility helpers; straightforward to test
6. `fileExists` + `chooseFile` + `openFile` — file helpers; test with mock ctx.fileExistsSync
7. `unflag` — pure function; single-test case is sufficient
