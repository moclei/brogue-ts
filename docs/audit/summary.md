# Audit Summary

**Completed:** 2026-03-06
**Files audited:** 20 C source files (19 gap files — Globals.c/GlobalsBase.c/Utilities.c combined)

---

## Overall Coverage

| Category | Count | % of total |
|---|---|---|
| IMPLEMENTED | 445 | 56.8% |
| STUBBED-TRACKED | 28 | 3.6% |
| STUBBED-UNTRACKED | 48 | 6.1% |
| MISSING | 72 | 9.2% |
| NEEDS-VERIFICATION | 139 | 17.7% |
| OUT-OF-SCOPE | 52 | 6.6% |
| DATA-ONLY | 0 | 0.0% |
| **Total** | **784** | **100%** |

Note: DATA-ONLY entries (Globals.c catalog data, GlobalsBase.c struct initializations) are not counted
as functions — they are noted in auditor remarks in gaps-Globals.md.

---

## Critical Gaps (required for basic gameplay)

These must be addressed before the game is playable end-to-end:

| Function | C File | Category | Impact |
|---|---|---|---|
| `getCellAppearance` | IO.c | MISSING | Level rendering completely absent — dungeon never drawn |
| `refreshDungeonCell` | IO.c | MISSING | Individual cell refresh absent — no visual updates |
| `displayLevel` | IO.c | STUBBED-UNTRACKED | Stubbed in lifecycle.ts:479; no test.skip (rule violation); entire level display no-ops |
| `saveRecording` | Recordings.c | MISSING | Wired into context interface and called at game-lifecycle.ts:378,596 — runtime crash at game end |
| `monsterCastSpell` | Monsters.c | MISSING | Entire monster spell-casting pipeline absent |
| `monstUseBolt` | Monsters.c | MISSING | Monster bolt-casting absent |
| `monstUseDomination` | Monsters.c | MISSING | Domination ability absent |
| `monstUseBeckon` | Monsters.c | MISSING | Beckon ability absent |
| `monstUseBlinkAway` | Monsters.c | MISSING | Blink-away absent |
| `monsterDetails` | Monsters.c | MISSING | Sidebar monster description non-functional |
| `applyTunnelEffect` | Items.c | MISSING | Core item-use effect absent |
| `teleport` | Items.c | MISSING | Teleport scroll/ring non-functional |
| `negationBlast` | Items.c | MISSING | Negation wand absent |
| `empowerMonster` | Items.c | MISSING | Empowerment mechanic absent |
| `itemIsCarried` | Items.c | MISSING | Item-carried check absent — affects drop/use logic |
| `displayInventory` | Items.c | MISSING | Inventory UI non-functional |
| `magicChargeItem` | Items.c | MISSING | Recharge wand absent |
| `updateFloorItems` | Items.c | MISSING | Per-turn item tick absent — fungal items won't spread, etc. |

(28 MISSING total in Items.c; see gaps-Items.md for full list. The above are the highest-impact subset.)

---

## Secondary Gaps (gameplay incomplete without, but not immediately blocking)

| Function / Group | C File | Category | Impact |
|---|---|---|---|
| 19 further MISSING item functions | Items.c | MISSING | Potions, scrolls, wands, staff effects — item system ~40% absent |
| ~16 further MISSING monster AI functions | Monsters.c | MISSING | Monster summon, polymorph, fear, confusion AI absent |
| `evacuateCreatures` | Architect.c | MISSING | Creature displacement before DF spawning — edge-case level gen gap |
| `hiliteGrid` | Grid.c | MISSING | Rendering utility — no gameplay impact, but needed for UI highlighting |
| `getTerrainGrid` / `getTMGrid` / `getPassableArcGrid` | Grid.c | MISSING | Internal static helpers (absorbed into other functions — low risk) |
| `dijkstraScan` (wiring) | Dijkstra.c | STUBBED-UNTRACKED (wiring) | Domain function IMPLEMENTED; wiring stub in input-context.ts:240 returns no-op |
| `getQualifyingPathLocNear` | Grid.c | STUBBED-TRACKED | Stubbed in movement/lifecycle/monsters; tracked in test.skip at monsters.test.ts:208, movement.test.ts:258 |
| `loadSavedGame` | Recordings.c | MISSING | Pre-emptive test.skip at menus.test.ts:117 — blocked by persistence layer |
| 2 internal C helpers in `dialogChooseFile` | MainMenu.c | MISSING | Static C helpers inlined in JS — not actual gameplay gaps |
| NEEDS-VERIFICATION backlog (139 total) | multiple | NEEDS-VERIFICATION | Real code exists but lacks direct test coverage — see table below |

### NEEDS-VERIFICATION backlog by file

| C File | Count | Nature of gap |
|---|---|---|
| PowerTables.c | 22 | Power computation functions — tested in isolation but 15 never imported in production; items using them unwired |
| RogueMain.c | 20 | Lifecycle orchestration (initializeGame, startNewGame, gameLoop, etc.) — real code exists, no direct tests |
| MainMenu.c | 20 | Menu rendering and state machines — real code, no direct tests |
| Monsters.c | 20 | Monster behavior functions — some may have silent simplifications vs. C |
| Architect.c | 18 | Dungeon generation top-level orchestration (digDungeon, buildAMachine, addMachines) — no direct tests |
| Buttons.c | 8 | Button rendering — real code in io/buttons.ts, no direct tests |
| Wizard.c | 10 | Wizard mode — fully ported, no direct tests |
| Light.c | 5 | Lighting functions — real implementations, no direct tests |
| Items.c | 5 | Item utility functions — real code, test coverage unclear |
| IO.c | 4 | Miscellaneous IO helpers |
| Movement.c | 3 | Movement utility functions |
| Time.c | 2 | Turn-processing helpers |
| Combat.c | 2 | Combat utility functions |

---

## Rule Violations (STUBBED-UNTRACKED — test.skip entries needed)

Every STUBBED-UNTRACKED entry violates the "no stub without a test.skip" rule. Phase 3b and 3c
will add the required test.skip entries.

| C File | Count | Phase to fix |
|---|---|---|
| IO.c | 13 | Phase 3b |
| Items.c | 12 | Phase 3b |
| Recordings.c | 13 | Phase 3c |
| Monsters.c | 7 | Phase 3c |
| Architect.c | 2 | Phase 3c |
| Time.c | 1 | Phase 3c |
| **Total domain stubs** | **48** | |

Additionally, ~12 untracked wiring stubs exist in context-builder files. Phase 3d covers these:

- `autoRest`, `manualSearch` — input-context.ts (Time.c notes)
- `enableEasyMode` — input-context.ts:203, `executeEvent` — menus.ts:256 (RogueMain.c notes)
- `listFiles`, `loadRunHistory`, `saveResetRun` — MainMenu.c notes
- 3 wiring stubs in input-context.ts and ui.ts — Buttons.c notes
- `terrainFlags`, `terrainMechFlags` — io/input-context.ts:247–248 (Globals.c notes)
- `dijkstraScan: () => {}` — input-context.ts:240 (Dijkstra.c notes)

### Stale test.skip entries to remove (Phase 3d)

- `movement.test.ts:241` — `useStairs` is now IMPLEMENTED
- `combat.test.ts:228,255,261,267,272` — 5 entries for functions now IMPLEMENTED

---

## Out-of-scope / acceptable gaps

| C File | Count | Reason |
|---|---|---|
| SeedCatalog.c | 10 | CLI seed-scanning tool (--seed-catalog flag); no gameplay logic; no TS equivalent needed |
| Recordings.c | 28 | File I/O, playback pipeline, RNG verification — deferred to persistence layer; browser has no filesystem |
| Globals.c / Utilities.c | 2 | C string helpers (endswith, append) superseded by native JS |
| IO.c | 1 | Platform-specific terminal sizing |
| Items.c | 1 | Platform-specific file I/O |
| Monsters.c | 6 | POSIX signals, terminal control, platform backend calls |
| Light.c | 1 | Platform-specific lighting backend |
| Wizard.c | 1 | qsort comparator inlined as JS sort |
| RogueMain.c | 2 | POSIX/SDL entry points (main, platform init) |
| **Total** | **52** | |

---

## Files with zero gaps

| C File | Status | Notes |
|---|---|---|
| Math.c | 100% IMPLEMENTED | rng.ts and fixpt.ts complete with C cross-validated tests |
| Dijkstra.c | 100% IMPLEMENTED | dijkstra.ts complete with tests; one wiring stub to track |

---

## Recommended follow-on initiative

The follow-on initiative should be `port-v2-fix-rendering` (working title). Recommended sequencing:

### Phase 1 — Rendering blockers (prerequisite for all visual testing)

Implement `getCellAppearance`, `refreshDungeonCell`, and `displayLevel` in IO.c / io/display.ts.
Without these, no dungeon is ever drawn. This is the highest-leverage fix: unblocking it enables
visual verification of everything else.

### Phase 2 — Runtime crash fix

Wire `saveRecording` into the game-lifecycle context builder. It is already declared in the interface
and called at game-lifecycle.ts:378 and game-lifecycle.ts:596. The missing wiring causes a crash at
game end. This is a one-line fix but has high runtime impact.

### Phase 3 — Item system (28 MISSING functions)

Items.c has the largest single-file gap (28 MISSING, 12 STUBBED-UNTRACKED). Priority sub-order:
inventory display → per-turn item updates → identify/use/drop flow → individual item effects.

### Phase 4 — Monster AI (27 MISSING functions)

Implement the spell/bolt-casting pipeline: `monsterCastSpell`, `monstUseBolt`, and each ability
function. Also implement `monsterDetails` for sidebar functionality. Priority: spell casting > summon
> domination/confusion > other abilities.

### Phase 5 — NEEDS-VERIFICATION review

139 functions need human review. Most are likely correct (real implementations exist). The highest-
risk subset is Monsters.c (20 entries — some may have silent behavioral simplifications) and
PowerTables.c (15 functions tested but never wired into production item code).

### Not blocking playtest

OUT-OF-SCOPE gaps (Recordings.c file I/O, SeedCatalog.c) are acceptable indefinitely until a
persistence layer is planned. NEEDS-VERIFICATION entries in PowerTables.c, RogueMain.c, and
MainMenu.c are low risk — they have real code.
