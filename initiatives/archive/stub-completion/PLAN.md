# Stub Completion — Plan

## Approach

The dominant pattern in this codebase is: **implementations exist in module files, but are not wired into `runtime.ts`**. The stub in `runtime.ts` is a simplified placeholder; the real function is already ported in a focused module. Work is primarily building DI context objects and swapping stubs for real calls.

A smaller set of stubs genuinely need new code: scent diffusion, `storeMemories()`, `handleHealthAlerts()`, level persistence, and the missing context helpers (`haste`, `makePlayerTelepathic`, `aggravateMonsters`, etc.).

Work is organized into five phases by impact and complexity.

---

## Phase 1: Quick Wiring Wins

**What:** Wire already-implemented functions that are currently stubbed in `runtime.ts`.

- **`updateLighting()`** — `light/light.ts:updateLighting()` is complete. The stub at line 4271 just needs `updateLightingFn(buildLightingContext())`.
- **`monstersAreEnemies()` / `monsterIsInClass()`** — real implementations exist in `monster-queries.ts`. The `buildTurnProcessingContext` returns `true`/`false` simplified versions.
- **`monsterName()` in TurnProcessingContext** — simplified to `"monster"`, real implementation exists.
- **`storeMemories()`** — copy `tmap[x][y]` color data to `pmap[x][y].rememberedAppearance` and `pmap[x][y].rememberedTerrain`.

**Effort:** 1–2 hours. Targeted changes to runtime.ts, no new files.

---

## Phase 2: Item Apply — Bolt Catalog + ItemHandlerContext

**What:** Make `apply()` work for all item types (scrolls, potions, food, staffs, wands, charms).

**Steps:**
1. **Port bolt catalog** — Create `ts/src/globals/bolt-catalog.ts` from C's `GlobalsBrogue.c`. 29 entries. Update `Bolt` interface to allow nullable colors.
2. **Port missing helper functions** — `haste()`, `makePlayerTelepathic()`, `imbueInvisibility()`, `aggravateMonsters()`, `rechargeItems()`, `negationBlast()`, `discordBlast()`, `crystalize()`, `summonGuardian()`. Implement inline in runtime.ts or in a new `ts/src/items/item-effects.ts`.
3. **Build `buildItemHandlerContext()`** in runtime.ts — large context builder (~300 lines) wiring all game state and helper functions.
4. **Replace stub `apply()`** in `buildInputContext()` to call the real `item-handlers.ts:apply()`.
5. **Implement `chooseTarget()`** — simplified auto-targeting (nearest visible monster) for first pass. Can be made interactive in a later session.

**Notes:**
- Staffs/wands use `chooseTarget()` and then `zap()`. `zap()` (the actual bolt projectile) is out of scope for this initiative. For now, staffs/wands will select a target and decrement charges without the visual bolt effect.
- Food, potions, and scrolls do not require targeting and will be fully functional.

**Effort:** 4–6 hours. Largest task in the initiative.

---

## Phase 3: Full Monster AI

**What:** Replace the simplified ~80-line `monstersTurn` in `buildTurnProcessingContext` with the full 606-line version from `monster-actions.ts`.

**Blockers:** The `MonstersTurnContext` interface requires several functions not yet implemented:

| Function | Description | Complexity |
|----------|-------------|------------|
| `monstUseMagic(monst)` | Ranged attacks, bolt-based abilities | High — port from Monsters.c |
| `traversiblePathBetween(monst, x, y)` | Check if unobstructed path exists | Medium |
| `scentDirection(monst)` | Best scent-following direction | Low — similar to existing simplified code |
| `isLocalScentMaximum(loc)` | Is this the highest scent nearby? | Low |
| `pathTowardCreature(monst, target)` | Move via Dijkstra toward target | Medium |
| `monsterBlinkToPreferenceMap()` | Blink to preferred cell | High — needs bolt mechanics |
| `monsterBlinkToSafety()` | Blink to safety | High |
| `updateMonsterCorpseAbsorption()` | Corpse-eating behavior | Medium |
| `monsterMillAbout(monst, chance)` | Wander randomly in place | Low |
| `moveAlly(monst)` | Ally follow/assist behavior | Medium |
| `isValidWanderDestination(monst, idx)` | Check waypoint validity | Low |
| `waypointDistanceMap(idx)` | Get Dijkstra map to waypoint | Low — wiring |
| `wanderToward(monst, loc)` | Move toward a location | Low |
| `randValidDirectionFrom(monst, x, y, diag)` | Random valid move direction | Low |

**Strategy:** Port functions in order of impact. `scentDirection`, `isLocalScentMaximum`, `pathTowardCreature`, `monsterMillAbout`, `moveAlly`, `wanderToward`, `randValidDirectionFrom` are all low-to-medium complexity and needed for fleeing/wandering. `monstUseMagic` is high-complexity but can be stubbed initially (monsters won't cast spells).

**Effort:** 6–8 hours total across multiple sessions.

---

## Phase 4: Player Turn Systems

**What:** Small standalone implementations that improve the gameplay loop.

- **`handleHealthAlerts()`** — Port from `IO.c`. Checks HP and nutrition thresholds, flashes messages. ~50 lines.
- **`confirm()` dialog** — Replace `return true` stub with a real yes/no dialog using `io-input.ts` infrastructure. ~30 lines.
- **`demoteVisibility()`** — Clear `VISIBLE` flag properly when cells leave FOV. ~15 lines.
- **`currentStealthRange()`** — Replace `return 0` with real calculation from `Movement.c`. ~10 lines.
- **`clearCursorPath()`** — Wire mouse-path preview clearing. ~10 lines.

**Effort:** 2–3 hours.

---

## Phase 5: Level Persistence + Remaining Item Actions

**What:** Level revisit persistence and the remaining item interaction stubs.

- **`restoreMonster()`** in `architect.ts` — Serialize/deserialize creatures when leaving/returning to a depth. Needs qualifying-path search.
- **`restoreItems()`** in `architect.ts` — Item persistence across depth visits.
- **`relabel()`** — Text input via `getInputTextString()`, reassign inventory letter. ~20 lines.
- **`call()`** — Text input, set custom item/category name. ~20 lines.
- **`swap()`** — Ring slot swap using existing equipment system. ~30 lines.
- **`useKeyAt()`** — Complete implementation (currently partially stubbed).

**Effort:** 4–6 hours.

---

## Technical Notes

### Context Builder Pattern

All context builders in runtime.ts follow the same pattern:
```typescript
function buildFooContext(): FooContext {
    return {
        // Close over shared state: player, rogue, pmap, monsters, etc.
        // Delegate to module functions with the right sub-context
    };
}
```
When adding new context builders, reference nearby builders (e.g., `buildCreatureEffectsContext`, `buildMiscHelpersContext`) as templates.

### Bolt Catalog

The bolt catalog maps `BoltType` enum values to `Bolt` objects. In C, some bolts have `NULL` for `foreColor` or `backColor`. The TS `Bolt` interface will be updated to `foreColor: Color | null; backColor: Color | null` to match.

### Missing Status Effect Setters

Functions like `haste()`, `makePlayerTelepathic()`, `imbueInvisibility()` are simple status effect setters (1–5 lines of state mutation + refresh). Implement them inline in the context builder or factor them into `creature-effects.ts`.

## Open Questions

- `chooseTarget()` interactive vs. auto-targeting: for now, auto-target nearest enemy. Make interactive in a follow-up session once Phase 3 is done.
- `monstUseMagic()` stub vs. port: start with a stub returning `false` so monsters don't cast spells. Port properly in Phase 3 follow-up.
