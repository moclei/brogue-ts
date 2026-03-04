# Stub Completion — Tasks

## Phase 1: Quick Wiring Wins ✅

- [x] Wire `updateLighting()` — call `updateLightingFn(buildLightingContext())` in cost-map FOV context (runtime.ts ~4289)
- [x] Wire `monstersAreEnemies()` in `buildTurnProcessingContext` — call real `monstersAreEnemiesFn` (runtime.ts ~6371)
- [x] Wire `monsterIsInClass()` in `buildTurnProcessingContext` — call real `monsterIsInClass` (runtime.ts ~6375)
- [x] Wire `monsterName()` in `buildTurnProcessingContext` — real article/name logic (runtime.ts ~6360)
- [x] Implement `storeMemories(x, y)` — copy `tmap[x][y]` appearance to `pmap[x][y].rememberedAppearance` and set `rememberedTerrain` (runtime.ts ~6731)
- [x] Verify: 0 compilation errors, all 2,264 tests passing

## Phase 2: Item Apply ✅

- [x] Update `Bolt` interface in `types/types.ts` — change `foreColor`/`backColor` to `Color | null`
- [x] Port bolt catalog — create `ts/src/globals/bolt-catalog.ts` with 30 entries from `GlobalsBrogue.c`
- [x] Export bolt catalog from `ts/src/globals/index.ts`
- [x] Port missing effect functions (implemented inline in `buildItemHandlerContext()`):
  - [x] `haste(target, duration)` — set `STATUS_HASTED` on creature
  - [x] `makePlayerTelepathic(duration)` — set `STATUS_TELEPATHIC` on player
  - [x] `imbueInvisibility(target, duration)` — set `STATUS_INVISIBLE` on creature
  - [x] `aggravateMonsters(range, x, y, color)` — wake monsters within radius
  - [x] `rechargeItems(category)` — recharge all pack items of category
  - [x] `negationBlast(source, radius)` — negate monsters + strip item charges in FOV
  - [x] `discordBlast(source, radius)` — set Discordant on monsters in FOV within radius
  - [x] `crystalize(radius)` — turn walls to force-field within radius
  - [x] `summonGuardian(charm)` — stubbed (returns without effect for now)
- [x] Build `buildItemHandlerContext()` in runtime.ts — full DI context wiring all fields (~360 lines)
- [x] Wire `chooseTarget()` — simplified auto-target (nearest visible enemy in FOV)
- [x] Replace stub `apply()` in `buildInputContext()` to call `applyFn(theItem, buildItemHandlerContext())`
- [x] Verify: 0 compilation errors, all 2,264 tests passing
- [ ] Smoke test: drink a potion, read a scroll, eat food, zap a wand — all produce effects

## Phase 3: Full Monster AI ✅

- [x] Port `scentDirection(monst)` — find direction of strongest uphill scent
- [x] Port `isLocalScentMaximum(loc)` — check if at local scent peak
- [x] Port `pathTowardCreature(monst, target)` — Dijkstra move toward creature
- [x] Port `traversiblePathBetween(monst, x, y)` — unobstructed path check
- [x] Port `monsterMillAbout(monst, chance)` — random in-place wandering
- [x] Port `randValidDirectionFrom(monst, x, y, diag)` — random valid direction
- [x] Port `wanderToward(monst, loc)` / exported from monster-actions.ts
- [x] Port `moveAlly(monst)` — ally follow/assist behavior
- [x] Port `isValidWanderDestination(monst, idx)` — waypoint validity check
- [x] Wire `waypointDistanceMap(idx)` — return precomputed waypoint Dijkstra map
- [x] Stub `monstUseMagic(monst)` — returns `false` (monsters won't cast spells)
- [x] Stub `monsterBlinkToPreferenceMap()` / `monsterBlinkToSafety()` — return `false`
- [x] Stub `updateMonsterCorpseAbsorption()` — return `false`
- [x] Build `buildMonstersTurnContext()` in runtime.ts wiring all the above
- [x] Replace simplified `monstersTurn` with `monstersTurnFn(monst, buildMonstersTurnContext())`
- [x] Verify: 0 compilation errors, all 2,264 tests passing
- [ ] Smoke test: monkeys flee, turrets fire, followers stay near leader

## Phase 4: Player Turn Systems

- [ ] Implement `handleHealthAlerts()` — HP and nutrition threshold warnings with flashing messages
- [ ] Wire `confirm()` dialog — replace `return true` with real yes/no prompt
- [ ] Implement `demoteVisibility()` — clear `VISIBLE` flag on out-of-FOV cells (wire to FOV system)
- [ ] Implement `currentStealthRange()` — port full calculation from Movement.c
- [ ] Wire `clearCursorPath()` — clear mouse-path preview cells
- [ ] Verify: 0 compilation errors, all tests passing

## Phase 5: Level Persistence + Remaining Item Actions

- [ ] Implement `restoreMonster()` in `architect.ts` — creature persistence across depth visits
- [ ] Implement `restoreItems()` in `architect.ts` — item persistence across depth visits
- [ ] Implement `relabel()` — text input via `getInputTextString`, reassign inventory letter
- [ ] Implement `call()` — text input, set custom item/category name
- [ ] Implement `swap()` — ring slot swap using existing equipment system
- [ ] Complete `useKeyAt()` — finish key usage for cages/doors
- [ ] Verify: 0 compilation errors, all tests passing
