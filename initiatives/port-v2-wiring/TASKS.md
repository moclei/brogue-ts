# Port V2 — Wiring — Tasks

## Phase 1: core.ts
- [x] Define shared mutable state variables (player, rogue, pmap, tmap, monsters, items, etc.)
- [x] Implement `initGameState()` — initialize all state to fresh-game values
- [x] Implement `gameOver()` — set gameHasEnded, record message
- [x] Export `getGameState()` for use by domain context builders
- [x] Write unit test: `initGameState()` produces valid initial state — 17 tests, all passing
- [x] Verify `core.ts` is under 600 lines — 319 lines; `game-constants.ts` extracted at 71 lines

## Phase 2: turn.ts (turn processing)
- [x] Write integration test FIRST: full `playerTurnEnded()` with 3 monsters, one dying mid-turn — verify no soonestTurn warnings, monsters removed cleanly
- [x] Implement `buildTurnProcessingContext()` — wire all fields from `time/turn-processing.ts`
- [x] Implement `buildMonstersTurnContext()` — wire monster AI context (stubs; real AI in monsters.ts)
- [x] Verify integration test passes — 6 passing, 5 skipped stubs
- [x] Enumerate any stubs from `monsters/monster-actions.ts` as `test.skip` items — 5 stubs recorded
- [x] Verify `turn.ts` is under 600 lines — 392 lines

## Phase 3: combat.ts (combat + damage)
- [x] Write integration test FIRST: player attacks monster, monster dies, drops item, removed from monster list
- [x] Implement `buildCombatDamageContext()` — wire inflictDamage, killCreature, etc.
- [x] Implement `buildCombatAttackContext()` — wire player/monster attack resolution
- [x] Verify integration test passes — 7 passing, 11 skipped stubs
- [x] Verify `combat.ts` is under 600 lines — 259 lines

## Phase 4: monsters.ts (monster spawning + state)
- [x] Write integration test FIRST: spawn a horde, verify monsters have valid movementSpeed and ticksUntilTurn > 0
- [x] Implement `buildMonsterSpawningContext()` — wire horde spawning
- [x] Implement `buildMonsterStateContext()` — wire state transitions, ally management
- [x] Verify integration tests pass — 8 passing, 9 skipped stubs
- [x] Verify `monsters.ts` is under 600 lines — 264 lines

## Phase 5: items.ts (item handling)
- [x] Write integration test FIRST: player drinks a potion, effect applies, turn advances
- [x] Implement `buildItemHandlerContext()` — wire all item use functions
- [x] Implement `buildItemHelperContext()` — wire key use, item helper ops
- [x] Verify integration test passes — 7 passing, 11 skipped stubs
- [x] Verify `items.ts` is under 600 lines — 378 lines

## Phase 6: movement.ts (player movement + travel)
- [x] Write integration test FIRST: player moves one step, tick advances, FOV updates
- [x] Implement `buildMovementContext()` — wire player movement, weapon attacks
- [x] Implement `buildTravelContext()` — wire travel/explore, path display
- [x] Implement `buildCostMapFovContext()` — wire cost map / FOV context (renamed from buildTargetingContext)
- [x] Verify integration tests pass — 11 passing, 12 skipped stubs
- [x] Verify `movement.ts` is under 600 lines — 574 lines

## Phase 7: ui.ts (display context)
- [x] Implement `buildDisplayContext()` — wire level display, cell rendering (stub display calls for now)
- [x] Implement `buildMessageContext()` — wire message queue
- [x] Implement `buildInventoryContext()` — wire inventory display (stub IO calls)
- [x] Implement `buildButtonContext()` — wire button input loop with proper async event waiting
- [x] Write test: `buildButtonContext().nextBrogueEvent` is async (not synchronous)
- [x] Verify `ui.ts` is under 600 lines — 358 lines; `core.ts` updated to 356 lines; 25 tests passing

## Phase 8: Stub audit
- [x] Search all `rogue-ts/src/` for any `/* stub */` comments NOT paired with a `test.skip` — no `/* stub */` format; `// stub` format used throughout
- [x] For each unpaired stub, add a `test.skip` describing correct behavior — added 13 to ui.test.ts, 5 to monsters.test.ts, 3 to movement.test.ts
- [x] Record final `test.skip` count as known-incomplete behaviors — **69 skipped total** (48 pre-existing + 21 new from Phases 7 & 8)

## Completion
- [x] All integration tests passing (not just unit tests) — 1538 passing, 69 skipped, 0 failing
- [x] Zero unpaired stubs — all stubs have corresponding test.skip entries
- [x] All domain files under 600 lines — core.ts 356, turn.ts 392, combat.ts 259, monsters.ts 264, items.ts 378, movement.ts 574, ui.ts 358
- [x] `rogue-ts/src/` committed: "feat: port-v2 wiring layer — domain context builders complete" — commit 991ccb0
