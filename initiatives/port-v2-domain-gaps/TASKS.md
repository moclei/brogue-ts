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

## Phase 2c: Spell effects — disentangle + teleport ✓

- [x] Implement `disentangle` (Monsters.c:1138) — DisentangleContext + disentangle() in
      new file monsters/monster-teleport.ts; exported from items/index.ts
- [x] Implement `teleport` (Monsters.c:1146) — TeleportContext + teleport() in
      monsters/monster-teleport.ts; wired into ItemHandlerContext in items.ts
- [x] Split buildItemHelperContext to items/item-helper-context.ts (items.ts at 593 lines)
- [x] Remove STUB Phase 2c comments from zap-context.ts
- [x] 24 new tests in tests/monsters/monster-teleport.test.ts (all pass)
- [x] Remove test.skip for teleport in tests/items.test.ts; replaced with smoke test
- [x] All 67 test files pass (1723 pass, 127 skip)
- [x] Committed

## Phase 3a: Monster flee AI — getSafetyMap + allyFlees ✓

- [x] Read `src/brogue/Monsters.c` getSafetyMap (2371) + allyFlees (2988) — map dependencies
- [x] Implement `getSafetyMap` — new file monsters/monster-flee-ai.ts;
      `fleeingMonsterAwareOfPlayer` helper co-located; `monsterFleesFrom` already in
      monsters/monster-state.ts
- [x] Implement `allyFlees` (2988) + `fleeingMonsterAwareOfPlayer` (2363) — monster-flee-ai.ts
- [x] Wire getSafetyMap into turn.ts buildMonstersTurnContext() (replaces allocGrid() stub);
      allyFlees wired via MoveAllyContext (interface already declared; moveAlly still stubbed —
      will unwrap when full ally AI is wired in a later phase)
- [x] 20 new tests in tests/monsters/monster-flee-ai.test.ts — all pass; no test.skip removals
      (no prior skips existed for these functions)
- [x] All 68 test files pass (1743 pass, 127 skip)
- [x] Committed

## Phase 3b: Monster blink AI ✓

- [x] Implement `perimeterCoords` (Monsters.c:2260) — pure, co-located in monster-blink-ai.ts
- [x] Implement `monsterBlinkToPreferenceMap` (Monsters.c:2290) — new file monsters/monster-blink-ai.ts;
      MonsterBlinkContext interface; uses getImpactLoc with T_OBSTRUCTS_PASSABILITY cellBlocks + no
      creatureBlocks; staffBlinkDistance(5*FP_FACTOR) for maxDistance
- [x] Implement `monsterBlinkToSafety` (Monsters.c:2394) — same file; MonsterBlinkToSafetyContext
      extends MonsterBlinkContext + GetSafetyMapContext; delegates to monsterBlinkToPreferenceMap
- [x] Wire both into turn.ts buildMonstersTurnContext() — blinkCtx + blinkToSafetyCtx built before
      boltAICtx; replace `() => false` stubs; zap/combatMessage still stubbed for port-v2-platform
- [x] Export from monsters/index.ts: perimeterCoords, monsterBlinkToPreferenceMap, monsterBlinkToSafety +
      MonsterBlinkContext, MonsterBlinkToSafetyContext types
- [x] Remove 2 test.skip entries from monster-actions.test.ts
- [x] 22 new tests in tests/monsters/monster-blink-ai.test.ts — all pass
- [x] All 69 test files pass (1765 pass, 125 skip)
- [x] Committed

## Phase 4a: Monster summoning — perimeterCoords + swarming + summonMinions ✓

Note: disentangle completed in Phase 2c; perimeterCoords completed in Phase 3b.

- [x] Implement `creatureEligibleForSwarming` (Monsters.c:2134) — monsters/monster-swarm-ai.ts;
      pure predicate checking immobility flags, status effects, seizing state, creature state
- [x] Implement `monsterSwarmDirection` (Monsters.c:2160) — same file; MonsterSwarmContext;
      shuffles cardinal/diagonal dirs independently; checks flanking cell + ally analysis
- [x] Implement `summonMinions` (Monsters.c:976) — monsters/monster-summoning.ts;
      SummonMinionsContext; pickHordeType + spawnMinions + MA_ENTER_SUMMONS path;
      HORDE_SUMMONED_AT_DISTANCE deferred; IO callbacks stubbed for port-v2-platform
- [x] Wire summonMinions into turn.ts summonsCtx; imports buildMonsterSpawningContext
      from monsters.ts; removed test.skip in monster-actions.test.ts
- [x] 22 new tests in monster-swarm-ai.test.ts; 18 new in monster-summoning.test.ts
- [x] All 71 test files pass: 1806 pass, 124 skip
- [x] Committed (5614065)

## Phase 4b: Monster combat gaps ✓

- [x] Implement `specifiedPathBetween` (Monsters.c:2014) — new file monsters/monster-path-queries.ts;
      uses getLineCoordinates from bolt-geometry.ts; SpecifiedPathContext with cellHasTerrainFlag +
      cellHasPmapFlags
- [x] Implement `dormantMonsterAtLoc` (Monsters.c:2062) — same file; DormantMonsterContext;
      checks HAS_DORMANT_MONSTER flag before scanning dormant list
- [x] Implement `becomeAllyWith` (Movement.c:513) — new file monsters/monster-lifecycle.ts;
      BecomeAllyContext; full impl: demote leadership, drop item, recurse carriedMonster, set
      ally state + MB_FOLLOWER, clear MB_CAPTIVE/MB_SEIZED; upgraded stub in
      buildMonsterSpawningContext (simplified single-level demoteMonsterFromLeadership)
- [x] Implement `cloneMonster` (Monsters.c:559) — same file; CloneMonsterContext; deep-copies
      monst (info/status/arrays), clears transient fields, always prepends to monsters;
      carriedMonster clone adds then removes; captive→becomeAllyWith; placeClone=true uses
      getQualifyingPathLocNear; player clone adjusts stats; jellymancer feat check
- [x] Implement `resurrectAlly` (Monsters.c:2889) — same file; ResurrectAllyContext; picks
      highest-power ally from purgatory (ties broken by monsterID); moves to monsters, places
      near loc, clears dying flags, resets burning/discordant, heals 100% panacea;
      MA_ENTER_SUMMONS resets info from catalog + reinitializes status
- [x] Wire becomeAllyWith into buildMonsterSpawningContext in monsters.ts; removed test.skip
      from monsters.test.ts (stub: becomeAllyWith sets Ally state only)
- [x] 21 tests in monster-path-queries.test.ts + 35 tests in monster-lifecycle.test.ts = 56 new
- [x] All 73 test files pass: 1862 pass, 123 skip
- [x] Committed

## Phase 5: spawnDungeonFeature + remaining smaller helpers ✅

- [x] Locate `spawnDungeonFeature` — already implemented in `architect/machines.ts:979`
- [x] Wire `spawnDungeonFeature` into movement.ts and items.ts contexts (unblocks
      vomit wiring; gas-tile spawn test passes in both contexts)
- [x] Wire `vomit` in movement.ts to real `vomitFn` with VomitContext
- [x] Implement smaller helpers in `items/item-utils.ts`:
      `lotteryDraw`, `describeMonsterClass`, `keyMatchesLocation`,
      `monsterClassHasAcidicMonster`, `beckonMonster`
- [x] 22 new tests in items/item-utils.test.ts; 2 new tests in movement.test.ts + items.test.ts
- [x] All 74 test files pass: 1886 pass, 121 skip
- [x] movement.ts: 599 lines (under 600 limit)
- [x] Committed

## Phase 6: throwItem + hitMonsterWithProjectileWeapon ✅

Bolt system (Phase 1d) is complete — this dependency is now resolved.

- [x] Implement `hitMonsterWithProjectileWeapon` (Items.c:5999, ~80 lines) — new file
      items/throw-item.ts; HitMonsterContext; projectile weapon combat math
- [x] Implement `throwItem` (Items.c:6080, ~197 lines) — same file; ThrowItemContext;
      path computation via getLineCoordinates, hit detection, item effects on impact
      (potions shatter, incendiary darts ignite, etc.), place or delete item after landing;
      async due to pauseAnimation in flight loop; ThrowItemRenderContext stubs
- [x] 24 new tests in tests/items/throw-item.test.ts (all pass)
- [x] Exported from items/index.ts; no test.skip entries existed for these functions
- [x] 75 test files, 1910 pass, 121 skip
- [x] Committed (db2779e)

Note: `throwCommand` (the targeting wrapper, Items.c:6282) belongs to port-v2-platform —
only the domain logic goes here.

## Phase 7: Enchant-swap group ✅

Self-contained mechanic; no IO dependencies for core logic. All 4 functions call each other.

- [x] Implement `enchantLevelKnown` (Items.c:1142) — pure predicate added to item-inventory.ts
- [x] Implement `effectiveEnchantLevel` (Items.c:1152) — pure accessor added to item-inventory.ts
- [x] Implement `swapItemToEnchantLevel` (Items.c:1085) — new file items/item-enchant-swap.ts;
      SwapItemToEnchantLevelContext; shatter path + enchant update path; charm recharge scaling
- [x] Implement `swapItemEnchants` (Items.c:1160) — same file; SwapItemEnchantsContext;
      scans pmap for TM_SWAP_ENCHANTS_ACTIVATION cells; WAND excluded from CAN_BE_SWAPPED
- [x] 46 new tests in item-enchant-swap.test.ts; 1 test.skip removed from floor-items.test.ts
- [x] Exported from items/index.ts; STUB comment removed from UpdateFloorItemsContext
- [x] 76 test files, 1947 pass, 120 skip
- [x] Committed (4930fa6)

---

## Deferred

[from: port-v2-fix-rendering] Targeting UI: `hiliteTrajectory`, `moveCursor`,
  `nextTargetAfter`, `chooseTarget`, `playerCancelsBlinking` — IO/UI layer;
  tracked in port-v2-platform TASKS.md Phase 8.

[from: port-v2-fix-rendering] `inscribeItem`, `itemCanBeCalled` — UI-dependent;
  tracked in port-v2-platform TASKS.md Phase 8.
