# TASKS: port-v2-fix-rendering

Each sub-phase is one session's work. Commit and generate a handoff prompt after each.

---

## Phase 1a: Understand getCellAppearance

- [x] Read IO.c `getCellAppearance` — map all inputs, branches, and output fields to TS types
- [x] Read `docs/audit/gaps-IO.md` — confirm what is already in `io/display.ts` vs what is missing
- [x] Document findings as a `## Session Notes` in PLAN.md (inputs, output shape, lighting dependency question)
- [ ] Commit notes; generate handoff

## Phase 1b: Implement getCellAppearance

- [ ] Implement `getCellAppearance` in `rogue-ts/src/io/display.ts`
- [ ] Add unit test (or test.skip if lighting dependency blocks full test)
- [ ] Commit; generate handoff

## Phase 1c: Implement refreshDungeonCell + displayLevel

- [ ] Implement `refreshDungeonCell` in `rogue-ts/src/io/display.ts`
- [ ] Remove `displayLevel` stub from `lifecycle.ts`; implement in `rogue-ts/src/io/display.ts`
- [ ] Verify test.skip entries exist for any remaining gaps
- [ ] Smoke test: dungeon renders after "New Game" in browser
- [ ] Commit; generate handoff

## Phase 2: Runtime crash fix (saveRecording)

- [ ] Locate `saveRecording` call sites in `game-lifecycle.ts` (lines 378, 596)
- [ ] Add no-op `saveRecording: () => {}` stub to context builder in `lifecycle.ts`
- [ ] Add `test.skip` tracking the stub
- [ ] Verify game end no longer crashes
- [ ] Commit; generate handoff

## Phase 3a: Item system — inventory + floor tick

- [ ] Read `docs/audit/gaps-Items.md` — confirm full 28 MISSING + 12 STUBBED-UNTRACKED list
- [ ] Implement `displayInventory`
- [ ] Implement `updateFloorItems`
- [ ] Remove test.skip entries for implemented functions
- [ ] Commit; generate handoff

## Phase 3b: Item system — use/drop flow utilities

- [ ] Implement `itemIsCarried` and item quantity utilities
- [ ] Implement identify / use / drop flow functions
- [ ] Remove test.skip entries for implemented functions
- [ ] Commit; generate handoff

## Phase 3c: Item system — core item effects

- [ ] Implement `applyTunnelEffect`, `teleport`, `negationBlast`
- [ ] Implement `empowerMonster`, `magicChargeItem`
- [ ] Remove test.skip entries for implemented functions
- [ ] Commit; generate handoff

## Phase 3d: Item system — remaining effects

- [ ] Implement remaining potion / scroll / wand effect functions (see gaps-Items.md)
- [ ] Remove test.skip entries for all newly implemented functions
- [ ] Commit; generate handoff

## Phase 4a: Monster AI — spell dispatch + bolt pipeline

- [ ] Read `docs/audit/gaps-Monsters.md` — confirm full 27 MISSING list
- [ ] Implement `monsterCastSpell`
- [ ] Implement `monstUseBolt`
- [ ] Remove test.skip entries for implemented functions
- [ ] Commit; generate handoff

## Phase 4b: Monster AI — targeted abilities

- [ ] Implement `monstUseDomination`, `monstUseBeckon`, `monstUseBlinkAway`
- [ ] Implement `monsterDetails` (sidebar description)
- [ ] Remove test.skip entries for implemented functions
- [ ] Commit; generate handoff

## Phase 4c: Monster AI — summon / polymorph / fear / confusion

- [ ] Implement summon, polymorph, fear, confusion AI functions
- [ ] Remove test.skip entries for all newly implemented functions
- [ ] Commit; generate handoff

## Phase 5a: NEEDS-VERIFICATION — Monsters.c + PowerTables.c

- [ ] Review Monsters.c 20 NEEDS-VERIFICATION functions; fix or add test.skip for divergences
- [ ] Review PowerTables.c 15 unwired functions; wire into item code or document why not
- [ ] Commit; generate handoff

## Phase 5b: NEEDS-VERIFICATION — RogueMain.c + remainder

- [ ] Review RogueMain.c 20 NEEDS-VERIFICATION functions
- [ ] Review remaining entries (MainMenu.c, Architect.c, Buttons.c, etc.)
- [ ] Commit; generate handoff

---

## Deferred

[from: port-v2-audit] `loadSavedGame` — blocked on persistence layer; no filesystem in browser.
[from: port-v2-audit] Recordings.c file I/O (28 OUT-OF-SCOPE) — deferred to persistence layer initiative.
[from: port-v2-audit] SeedCatalog.c (10 OUT-OF-SCOPE) — CLI tool, no browser equivalent needed.
