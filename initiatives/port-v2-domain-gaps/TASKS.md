# TASKS: port-v2-domain-gaps

Each sub-phase is one session's work. Commit and generate a handoff prompt after each.

---

## Phase 1a: Item lifecycle — deleteItem + bolt item mapping ✓

- [x] Implement `deleteItem` (Items.c:7938) — exported no-op from items/item-inventory.ts;
      wired into lifecycle.ts buildCleanupContext and turn.ts buildMinimalCombatContext
- [x] Implement `boltEffectForItem` (Items.c:4337) + `boltForItem` (Items.c:4345) — new file
      items/bolt-item-mapping.ts; exported from items/index.ts; monster-details.ts updated to
      import from here (private duplicates removed)
- [x] Add tests: deleteItem in item-inventory.test.ts; boltForItem+boltEffectForItem in
      tests/items/bolt-item-mapping.test.ts (9 new tests)
- [x] No test.skip entries existed for these functions; all 61 test files pass (1607 pass, 131 skip)
- [x] Committed

## Phase 1b: Bolt/zap system — read-through + plan ✓

- [x] Read `src/brogue/Items.c`: `zap` (4814), `detonateBolt` (4720),
      `impermissibleKinkBetween` (3605), `tunnelize` (3631),
      `negationWillAffectMonster` (3690), `projectileReflects` (4206)
- [x] Map all inputs, branches, and dependencies for zap + detonateBolt
- [x] Document in Session Notes: dependency graph, file split plan (zap is large)
- [x] Committed notes; generated handoff

## Phase 1c: Bolt/zap system — implement helpers ✓

- [x] Implement `impermissibleKinkBetween`, `tunnelize`, `negationWillAffectMonster`,
      `projectileReflects` — items/bolt-helpers.ts (new file); exported from items/index.ts
- [x] Add unit tests: 27 tests in tests/items/bolt-helpers.test.ts (all pass)
- [x] Committed

## Phase 1d: Bolt/zap system — implement detonateBolt + zap ✓

- [x] Implement `detonateBolt` — items/bolt-detonation.ts (new file); handles BE_OBSTRUCTION,
      BE_CONJURATION, BE_BLINKING, BE_TUNNELING, targetDF spawn
- [x] Implement `zap` async — items/zap.ts (new file); full bolt-travel loop with creature/terrain
      reflection, tunneling, blink pre-flight, impact animation; uses ZapContext.render stubs
- [x] Add `randRange` to ZapContext (needed by reflectBolt); fix CreatureState magic numbers in
      bolt-update.ts
- [x] Add integration tests: 11 detonateBolt unit tests + 7 zap integration tests (18 new total)
- [x] No test.skip entries existed for these functions; no removals needed
- [x] All 64 test files pass (1652 pass, 131 skip)
- [x] Exported from items/index.ts: updateBolt, detonateBolt, zap, ZapContext, ZapRenderContext
- [x] Committed

## Phase 2a: Spell effects — negate / weaken / slow ✓

- [x] `negate` (Items.c:3734) — already fully implemented as `negateCreature` in
      monsters/monster-negate.ts; removed STUB Phase 2a comments from ZapContext
- [x] Implement `slow` (Items.c:3905) — SlowContext + slow() in item-effects.ts;
      exported from items/index.ts
- [x] Implement `weaken` (Items.c:3827) — WeakenContext + weaken() in item-effects.ts;
      exported from items/index.ts
- [x] Removed STUB Phase 2a comments from zap-context.ts (slow, negate)
- [x] 19 tests in tests/items/spell-effects.test.ts — all pass
- [x] No test.skip entries existed for these functions
- [x] All 65 test files pass (1671 pass, 131 skip)
- [x] Committed

## Phase 2b: Spell effects — polymorph / aggravateMonsters / crystalize / summonGuardian ✓

- [x] Implement `polymorph` (Items.c:3841)
- [x] Implement `aggravateMonsters` (Items.c:3358)
- [x] Implement `crystalize` (Items.c:4150)
- [x] Implement `summonGuardian` (Items.c:6651)
- [x] Wire into items context; add tests; remove test.skip entries
- [x] All 66 test files pass (1707 pass, 128 skip); 36 new tests in monster-spell-effects.test.ts
- [x] Committed

## Phase 2c: Spell effects — disentangle + teleport

- [ ] Implement `disentangle` (Monsters.c:1138) — prerequisite for teleport; new export in
      monsters/monster-state.ts or monsters/monster-ops.ts
- [ ] Implement `teleport` (Items.c:1146) — now unblocked; wire into items context
- [ ] Add tests; remove test.skip at items.test.ts:214
- [ ] Commit; generate handoff

## Phase 3a: Monster flee AI — getSafetyMap + allyFlees

- [ ] Read `src/brogue/Monsters.c` getSafetyMap (2371) + allyFlees (2988) — map dependencies
- [ ] Implement `getSafetyMap` — time/safety-maps.ts (domain function exists as interface
      only; turn.ts currently stubs with allocGrid())
- [ ] Implement `allyFlees` (2988) + `fleeingMonsterAwareOfPlayer` (2363)
- [ ] Wire getSafetyMap into turn.ts; wire allyFlees into MonstersTurnContext
- [ ] Add tests; remove relevant test.skip entries
- [ ] Commit; generate handoff

## Phase 3b: Monster blink AI

- [ ] Implement `monsterBlinkToPreferenceMap` (Monsters.c:2290)
- [ ] Implement `monsterBlinkToSafety` (Monsters.c:2394) — replaces STUBBED-UNTRACKED stub
- [ ] Wire both into turn.ts MonstersTurnContext; add tests; remove test.skip entries
- [ ] Commit; generate handoff

## Phase 4a: Monster summoning — perimeterCoords + swarming + summonMinions

Note: disentangle completed in Phase 2c.

- [ ] Implement `perimeterCoords` (Monsters.c:2260) — prerequisite for summonMinions
- [ ] Implement `creatureEligibleForSwarming` (Monsters.c:2134) +
      `monsterSwarmDirection` (Monsters.c:2160)
- [ ] Implement `summonMinions` (Monsters.c:976) — replaces `() => {}` stub in summonsCtx
- [ ] Wire into turn.ts summonsCtx; add tests; remove test.skip in monster-actions.test.ts
- [ ] Commit; generate handoff

## Phase 4b: Monster combat gaps

- [ ] Implement `cloneMonster` (Monsters.c:559) — wire into combat runic context
- [ ] Implement `resurrectAlly` (Monsters.c:2889)
- [ ] Implement `specifiedPathBetween` (Monsters.c:2014)
- [ ] Implement `dormantMonsterAtLoc` (Monsters.c:2062)
- [ ] Add tests; wire; remove test.skip entries
- [ ] Commit; generate handoff

## Phase 5: spawnDungeonFeature + remaining smaller helpers

- [ ] Locate `spawnDungeonFeature` in C source (Movement.c audit attributes it to Items.c
      but it is absent from gaps-Items.md — investigate; likely Architect.c)
- [ ] Implement `spawnDungeonFeature`; wire into movement.ts context (unblocks
      vomit/useKeyAt/printLocationDescription stubs)
- [ ] Implement smaller helpers: `describeMonsterClass` (Items.c:6890),
      `lotteryDraw` (Items.c:6857), `keyMatchesLocation` (Items.c:3305),
      `beckonMonster` (Items.c:4322), `monsterClassHasAcidicMonster` (Items.c:1869)
- [ ] Add tests; wire; remove test.skip entries
- [ ] Commit; generate handoff

---

## Deferred

[from: port-v2-fix-rendering] Targeting UI: `hiliteTrajectory`, `moveCursor`,
  `nextTargetAfter`, `chooseTarget` — IO/UI layer; belongs to port-v2-platform.

[from: port-v2-fix-rendering] `throwItem` + `hitMonsterWithProjectileWeapon` — throw mechanic;
  depends on bolt system (Phase 1d); schedule as follow-on after this initiative completes.

[from: port-v2-fix-rendering] Enchant-swap group: `swapItemToEnchantLevel`, `swapItemEnchants`,
  `enchantLevelKnown`, `effectiveEnchantLevel` — self-contained mechanic, not blocking core play.

[from: port-v2-fix-rendering] `inscribeItem` — item relabeling dialog; UI-dependent;
  belongs to port-v2-platform.

[from: port-v2-fix-rendering] `itemDetails`, `itemCanBeCalled` — sidebar/menu display;
  belongs to port-v2-platform.
