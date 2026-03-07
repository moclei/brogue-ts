# TASKS: port-v2-fix-rendering

Each sub-phase is one session's work. Commit and generate a handoff prompt after each.

---

## Phase 1a: Understand getCellAppearance

- [x] Read IO.c `getCellAppearance` — map all inputs, branches, and output fields to TS types
- [x] Read `docs/audit/gaps-IO.md` — confirm what is already in `io/display.ts` vs what is missing
- [x] Document findings as a `## Session Notes` in PLAN.md (inputs, output shape, lighting dependency question)
- [x] Commit notes; generate handoff

## Phase 1b: Implement getCellAppearance

- [x] Implement `getCellAppearance` in `rogue-ts/src/io/cell-appearance.ts` (new file)
- [x] Add unit tests: undiscovered cell + stable memory paths; test.skip for lighting round-trip
- [x] Commit; generate handoff

## Phase 1c: Implement refreshDungeonCell + displayLevel

- [x] Implement `refreshDungeonCell` in `rogue-ts/src/io/cell-appearance.ts` (per PLAN split)
- [x] Remove `displayLevel` stub from `lifecycle.ts`; implement via `displayLevelFn` from `io/cell-appearance.ts`
- [x] Verify test.skip entries exist for any remaining gaps (items.ts + input-context.ts stubs tracked in ui.test.ts)
- [ ] Smoke test: dungeon renders after "New Game" in browser
- [x] Commit; generate handoff

## Phase 2: Runtime crash fix (saveRecording)

- [x] Locate `saveRecording` call sites in `game-lifecycle.ts` (lines 378, 596)
- [x] Add no-op `saveRecording: () => {}` stub to context builder in `lifecycle.ts`
- [x] Add `test.skip` tracking the stub
- [x] Verify game end no longer crashes (TypeScript clean; saveRecording is no-op in buildLifecycleContext)
- [x] Commit; generate handoff

## Phase 3a: Item system — inventory + floor tick

- [x] Read `docs/audit/gaps-Items.md` — confirm full 28 MISSING + 12 STUBBED-UNTRACKED list
- [x] Implement `displayInventory` — already IMPLEMENTED at io/inventory-display.ts:52 per audit
- [x] Implement `updateFloorItems` — new file `rogue-ts/src/items/floor-items.ts`; exported from items/index.ts
- [x] Remove test.skip entries for implemented functions — N/A: updateFloorItems was MISSING (no prior test.skip); all 12 STUBBED-UNTRACKED entries already had test.skip in items.test.ts
- [x] Commit; generate handoff

## Phase 3b: Item system — use/drop flow utilities

- [x] Implement `itemIsCarried` and item quantity utilities — `itemIsCarried` already IMPLEMENTED
- [x] Implement `removeItemAt`, `placeItemAt`, `canDrop`, `dropItem` — new exports in items/floor-items.ts
- [x] Fix lifecycle.ts:475 `placeItemAt` bug — was not setting HAS_ITEM flag
- [x] Add test.skip entries for un-wired `dropItem` and `placeItemAt` context slots (turn.test.ts)
- [x] `identify` / `apply` already IMPLEMENTED; `drop` command remains STUBBED-TRACKED (ui.ts:317, needs full UI)
- [x] Commit; generate handoff

## Phase 3c: Item system — core item effects

- [x] Implement `negationBlast` — new `items/item-effects.ts` (and prerequisite `negateCreature` in `monsters/monster-negate.ts`)
- [x] `empowerMonster` — already IMPLEMENTED (monsters/monster-state.ts:228); no work needed
- [x] `applyTunnelEffect`, `magicChargeItem` — do not exist in C source; PLAN names were incorrect
- [x] `teleport` — deferred: requires `getTerrainGrid`, `getTMGrid`, `disentangle` (all missing); stub remains with test.skip at items.test.ts:214
- [x] Remove test.skip for negationBlast in items.test.ts (139 skips remain)
- [x] Commit; generate handoff

## Phase 3d: Item system — remaining effects

- [x] Implement remaining potion / scroll / wand effect functions (see gaps-Items.md)
      Implemented: haste, makePlayerTelepathic, imbueInvisibility, discordBlast,
      rechargeItems, updateIdentifiableItem, updatePlayerRegenerationDelay
      Deferred: slow, weaken, aggravateMonsters, crystalize, polymorph, summonGuardian
      (require bolt system or complex dependencies — not in scope for this phase)
- [x] Remove test.skip entries for all newly implemented functions (7 removed; 132 remain)
- [x] Commit; generate handoff

## Phase 4a: Monster AI — spell dispatch + bolt pipeline

- [x] Read `docs/audit/gaps-Monsters.md` — confirm full 27 MISSING list
- [x] Implement `monsterCastSpell`
- [x] Implement `monstUseBolt`
- [x] Implement `generallyValidBoltTarget`, `targetEligibleForCombatBuff`, `specificallyValidBoltTarget` (prerequisites for monstUseBolt)
- [x] Implement `monstUseMagic` (replaces monstUseMagicStub); wire into buildMonstersTurnContext in turn.ts
- [x] Remove test.skip for monstUseMagic in turn.test.ts; add real test (131 skips remain)
- [x] Commit; generate handoff

## Phase 4b: Monster AI — targeted abilities

- [x] `monstUseDomination`, `monstUseBeckon`, `monstUseBlinkAway` — do not exist as C functions; domination/beckoning are bolt effects handled by Phase 4a bolt pipeline; blink is `monsterBlinkToSafety` (STUBBED-UNTRACKED, deferred)
- [x] Implement `monsterDetails` — new files `monsters/monster-details-helpers.ts` + `monsters/monster-details.ts`; exported from monsters/index.ts
- [x] Add unit tests: `buildProperCommaString`, `monsterIsNegatable`, `getMonsterAbilitiesText`, `getMonsterDominationText` — 18 tests passing
- [x] Add `describe.skip` for `SidebarContext.monsterDetails` wiring (sidebar context builder not yet created)
- [x] Commit; generate handoff

## Phase 4c: Monster AI — summon / polymorph / fear / confusion

- [x] Implement `monsterHasBoltEffect` + `monsterCanShootWebs` as standalone functions in monster-bolt-ai.ts; wire into turn.ts MonstersTurnContext; 9 real tests in monster-bolt-ai.test.ts
- [x] Wire real `monsterSummons` into turn.ts boltAICtx + MonstersTurnContext (was `() => false`); add `summonMinions: () => {}` stub tracked with test.skip in monster-actions.test.ts
- [x] Polymorph / fear / confusion — handled by Phase 4a bolt pipeline; no additional functions needed
- [x] Remove test.skip entries for monsterHasBoltEffect + monsterCanShootWebs (131 skips remain; net -1)
- [x] Commit; generate handoff

## Phase 5a: NEEDS-VERIFICATION — PowerTables.c wiring fixes

- [x] Fix `staffBlinkDistance` context stub in items.ts (hardcoded `() => 0` → real fn)
- [x] Wire remaining 14 unwired power-table functions — N/A: all staff/weapon/ring fns are tested
      but their only call sites are inside the zap system (turn.ts `zap: () => {}`). No
      actionable wiring work exists until the zap pipeline is ported.
- [x] Add direct tests for 6 untested charm functions: charmHealing, charmShattering,
      charmGuardianLifespan, charmNegationRadius, charmEffectDuration, charmRechargeDelay
      (48 total tests in power-tables.test.ts; 131 test.skip entries remain)
      Note: charmRechargeDelay has a likely bug (extra FP_FACTOR scaling) — flagged in PLAN.md
- [x] Commit; generate handoff

## Phase 5b: NEEDS-VERIFICATION — Monsters.c read-through

- [ ] Read C source + TS port for each of the 20 NEEDS-VERIFICATION Monsters.c functions
- [ ] For each: confirm match, fix divergence, or add test.skip with description
- [ ] Commit; generate handoff

## Phase 5c: NEEDS-VERIFICATION — RogueMain.c + remainder

- [ ] Review RogueMain.c 20 NEEDS-VERIFICATION functions
- [ ] Review remaining entries (MainMenu.c, Architect.c, Buttons.c, etc.)
- [ ] Commit; generate handoff

---

## Deferred

[from: port-v2-audit] `loadSavedGame` — blocked on persistence layer; no filesystem in browser.
[from: port-v2-audit] Recordings.c file I/O (28 OUT-OF-SCOPE) — deferred to persistence layer initiative.
[from: port-v2-audit] SeedCatalog.c (10 OUT-OF-SCOPE) — CLI tool, no browser equivalent needed.
[from: port-v2-fix-rendering Phase 5a] Zap pipeline (`zapItem` in Items.c; `zap: () => {}` stub in turn.ts) — 14 staff/weapon/ring power-table functions are tested but have no reachable call site until this is ported. Port when combat/item-use pipeline is in scope.
