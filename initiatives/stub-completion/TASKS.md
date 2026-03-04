# Stub Completion — Tasks

## Phase 1: Quick Wiring Wins

- [ ] Wire `updateLighting()` — call `updateLightingFn(buildLightingContext())` in cost-map FOV context (runtime.ts ~4271)
- [ ] Wire `monstersAreEnemies()` in `buildTurnProcessingContext` — call real `monstersAreEnemiesFn` (runtime.ts ~5981)
- [ ] Wire `monsterIsInClass()` in `buildTurnProcessingContext` — call real `monsterIsInClassFn` (runtime.ts ~5985)
- [ ] Wire `monsterName()` in `buildTurnProcessingContext` — use `monsterNameFn` instead of `"monster"` (runtime.ts ~5977)
- [ ] Implement `storeMemories(x, y)` — copy `tmap[x][y]` appearance to `pmap[x][y].rememberedAppearance` and set `rememberedTerrain` (runtime.ts ~6341)
- [ ] Verify: 0 compilation errors, all tests passing

## Phase 2: Item Apply

- [ ] Update `Bolt` interface in `types/types.ts` — change `foreColor`/`backColor` to `Color | null`
- [ ] Port bolt catalog — create `ts/src/globals/bolt-catalog.ts` with 29 entries from `GlobalsBrogue.c`
- [ ] Export bolt catalog from `ts/src/globals/index.ts`
- [ ] Port missing effect functions (implement inline in runtime.ts or `item-effects.ts`):
  - [ ] `haste(target, duration)` — set `STATUS_HASTED` on creature
  - [ ] `makePlayerTelepathic(duration)` — set `STATUS_TELEPATHIC` on player
  - [ ] `imbueInvisibility(target, duration)` — set `STATUS_INVISIBLE` on creature
  - [ ] `aggravateMonsters(range, x, y, color)` — wake monsters within radius
  - [ ] `rechargeItems(category)` — recharge all pack items of category
  - [ ] `negationBlast(source, radius)` — negate monsters + strip item charges in FOV
  - [ ] `discordBlast(source, radius)` — set Discordant on monsters in FOV within radius
  - [ ] `crystalize(radius)` — turn walls to force-field within radius
  - [ ] `summonGuardian(charm)` — spawn guardian creature near player (stub if needed)
- [ ] Build `buildItemHandlerContext()` in runtime.ts — full DI context wiring all fields
- [ ] Wire `chooseTarget()` — simplified auto-target (nearest visible enemy in FOV)
- [ ] Replace stub `apply()` in `buildInputContext()` to call `applyFn(theItem, buildItemHandlerContext())`
- [ ] Verify: 0 compilation errors, all tests passing
- [ ] Smoke test: drink a potion, read a scroll, eat food, zap a wand — all produce effects

## Phase 3: Full Monster AI

- [ ] Port `scentDirection(monst)` — find direction of strongest uphill scent
- [ ] Port `isLocalScentMaximum(loc)` — check if at local scent peak
- [ ] Port `pathTowardCreature(monst, target)` — Dijkstra move toward creature
- [ ] Port `traversiblePathBetween(monst, x, y)` — unobstructed path check
- [ ] Port `monsterMillAbout(monst, chance)` — random in-place wandering
- [ ] Port `randValidDirectionFrom(monst, x, y, diag)` — random valid direction
- [ ] Port `wanderToward(monst, loc)` / export from monster-state.ts
- [ ] Port `moveAlly(monst)` — ally follow/assist behavior
- [ ] Port `isValidWanderDestination(monst, idx)` — waypoint validity check
- [ ] Wire `waypointDistanceMap(idx)` — return precomputed waypoint Dijkstra map
- [ ] Stub `monstUseMagic(monst)` — return `false` initially (monsters won't cast spells)
- [ ] Stub `monsterBlinkToPreferenceMap()` / `monsterBlinkToSafety()` — return `false`
- [ ] Stub `updateMonsterCorpseAbsorption()` — return `false`
- [ ] Build `buildMonstersTurnContext()` in runtime.ts wiring all the above
- [ ] Replace simplified `monstersTurn` in `buildTurnProcessingContext` with `monstersTurnFn(monst, buildMonstersTurnContext())`
- [ ] Verify: 0 compilation errors, all tests passing
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
