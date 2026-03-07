# TASKS: port-v2-fix-rendering

## Phase 1: Rendering blockers

- [ ] Read IO.c `getCellAppearance` and map inputs/outputs to TS types
- [ ] Implement `getCellAppearance` in `rogue-ts/src/io/display.ts`
- [ ] Implement `refreshDungeonCell` in `rogue-ts/src/io/display.ts`
- [ ] Remove `displayLevel` stub from `lifecycle.ts`; implement in `rogue-ts/src/io/display.ts`
- [ ] Add/update test.skip entries for any remaining gaps in Phase 1 functions
- [ ] Verify dungeon renders after "New Game" (visual smoke test in browser)
- [ ] Commit Phase 1

## Phase 2: Runtime crash fix

- [ ] Locate `saveRecording` call sites in `game-lifecycle.ts` (lines 378, 596)
- [ ] Add no-op `saveRecording` stub to context builder in `lifecycle.ts`
- [ ] Add `test.skip` entry tracking the stub
- [ ] Verify game end no longer crashes
- [ ] Commit Phase 2

## Phase 3: Item system

- [ ] Read `docs/audit/gaps-Items.md` — confirm full list of 28 MISSING + 12 STUBBED-UNTRACKED
- [ ] Implement `displayInventory`
- [ ] Implement `updateFloorItems`
- [ ] Implement `itemIsCarried` and item quantity utilities
- [ ] Implement identify / use / drop flow
- [ ] Implement `applyTunnelEffect`, `teleport`, `negationBlast`, `empowerMonster`, `magicChargeItem`
- [ ] Implement remaining potion / scroll / wand effect functions
- [ ] Remove test.skip entries for all newly implemented functions
- [ ] Commit Phase 3

## Phase 4: Monster AI

- [ ] Read `docs/audit/gaps-Monsters.md` — confirm full list of 27 MISSING functions
- [ ] Implement `monsterCastSpell`
- [ ] Implement `monstUseBolt`
- [ ] Implement `monstUseDomination`, `monstUseBeckon`, `monstUseBlinkAway`
- [ ] Implement summon / polymorph / fear / confusion AI functions
- [ ] Implement `monsterDetails`
- [ ] Remove test.skip entries for all newly implemented functions
- [ ] Commit Phase 4

## Phase 5: NEEDS-VERIFICATION review

- [ ] Review Monsters.c 20 NEEDS-VERIFICATION functions — fix or add test.skip for divergences
- [ ] Review PowerTables.c 15 unwired functions — wire into item code or document why not
- [ ] Review RogueMain.c 20 NEEDS-VERIFICATION functions
- [ ] Review remaining NEEDS-VERIFICATION entries (MainMenu.c, Architect.c, Buttons.c, etc.)
- [ ] Commit Phase 5

## Deferred

[from: port-v2-audit] `loadSavedGame` — blocked on persistence layer; no filesystem in browser.
[from: port-v2-audit] Recordings.c file I/O (28 OUT-OF-SCOPE) — deferred to persistence layer initiative.
[from: port-v2-audit] SeedCatalog.c (10 OUT-OF-SCOPE) — CLI tool, no browser equivalent needed.
