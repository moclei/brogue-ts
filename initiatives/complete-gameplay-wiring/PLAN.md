# Complete Gameplay Wiring — Plan

## Approach

The ~16 remaining actionable stubs are organized into 3 phases by gameplay impact. Each phase follows the established pattern: identify stubs, check/port the real functions, build or extend DI contexts in `runtime.ts`, replace stubs with real calls, verify compilation + tests.

```
Phase 1: Core Playability    → Stairs work, monsters respect terrain, food works, mouse hover
Phase 2: Combat & Monsters   → Weapon specials, cloning, stealing, teleportation, force weapons
Phase 3: World Simulation    → Periodic spawning, safety maps, clairvoyance, floor item decay
```

Each phase leaves the game in a strictly more playable state. Phase 1 is the critical priority — it addresses the two highest-impact stubs (monsterAvoids, startLevel) plus the single biggest UX gap (moveCursor).

---

## Phase 1: Core Playability

The "make it actually work" phase. After this, a player can navigate multiple dungeon levels, eat food, and monsters behave sanely around hazards. Mouse hover shows paths and cell info.

### 1a: monsterAvoids (8 contexts)

**What:** Wire `monsterAvoids()` from `monster-state.ts` across 8 DI contexts that currently use `() => false`.

**Where stubs are (in runtime.ts):**
- CostMapFovContext (×2, lines ~1001, ~1039)
- MonsterMovementContext (line ~3043)
- MonsterOpsContext (line ~3109)
- SpawnContext (line ~3470)
- MiscHelpersContext (line ~4168)
- TurnProcessingContext (line ~4378)
- PlayerMoveContext (line ~4642 area)

**Real function:** `monsterAvoids(monst, p, ctx: MonsterStateContext)` in `monsters/monster-state.ts`

**DI requirement:** Build a `MonsterStateContext` with map accessors (`terrainFlags`, `cellFlags`, `cellHasTMFlag`, `discoveredTerrainFlagsAtLoc`), monster helpers (`monsterAtLoc`, `monsterWillAttackTarget`), stair locations (`upLoc`, `downLoc`), player reference, and `passableArcCount`.

**Impact:** Monsters currently walk through lava, ignore chasms, and step on traps they should avoid. This is the single highest-impact gameplay fix.

### 1b: startLevel (1 context)

**What:** Wire `startLevel()` in CreatureEffectsContext so stairs trigger level transitions.

**Real function:** `startLevel(depth, stairDirection)` in `game/game-level.ts`

**DI requirement:** Needs `LevelContext` — which was already built for the initial startLevel call in the game init path. Reuse or extend that context builder for the CreatureEffectsContext caller.

**Impact:** Without this, players are trapped on depth 1. This is what makes the game a 26-floor dungeon crawler.

### 1c: eat (1 context)

**What:** Wire `eat()` in CreatureEffectsContext so food items satisfy hunger.

**Real function:** `eat()` in `items/item-handlers.ts` (via `ItemHandlerContext`)

**DI requirement:** Needs `ItemHandlerContext` with message functions, item naming, rogue state access.

**Impact:** Food does nothing → players starve unavoidably.

### 1d: recalculateEquipmentBonuses (2 contexts)

**What:** Wire `recalculateEquipmentBonuses()` in the 2 contexts where it's stubbed.

**Real function:** `recalculateEquipmentBonuses()` in `items/item-usage.ts`

**DI requirement:** Needs `EquipmentState` with access to rogue's weapon, armor, ring bonuses, and player creature stats.

**Impact:** Equipment stat bonuses may not refresh correctly after equip/unequip, causing cascading balance bugs.

### 1e: updatePlayerRegenerationDelay (port + wire)

**What:** Port `updatePlayerRegenerationDelay()` from Items.c:7903 (~15 lines) and wire it.

**C source:** Calculates regeneration tick delay based on max HP and ring of regeneration bonus. Simple formula: `turnsForFull = 1000 * maxHP / (maxHP <= 10 ? 18 : maxHP <= 25 ? 15 : 12)`, then applies regen ring bonus.

**Impact:** HP regeneration rate never updates when max HP changes (e.g. strength potion, life potion).

### 1f: moveCursor (port + wire)

**What:** Port `moveCursor()` from Items.c:5372 (~150 lines) and wire it in InputContext.

**C source:** The main input-processing function for the cursor system. Handles:
- Mouse movement → update `cursorLoc` to the map cell under the pointer
- Sidebar entity highlighting when hovering over sidebar entries
- Keyboard cursor movement (hjkl/arrow keys in examine mode)
- Button interaction (process action menu buttons via `processButtonInput`)
- Tab-targeting between visible monsters/items

**DI requirement:** Uses the existing `InputContext` — needs `nextBrogueEvent`, `processButtonInput`, `refreshSideBar`, sidebar location list, coordinate mapping, and button state management. Most dependencies are already wired.

**Impact:** This is the #1 UX gap. Without it: no path preview on mouse hover, no cell descriptions, no cursor-mode examine, no sidebar hover highlighting. The game feels unresponsive to mouse input.

---

## Phase 2: Combat & Monster Completeness

After this phase, all weapon types have their signature behaviors, monsters can clone/steal/teleport, and force weapons work.

### 2a: handleWhipAttacks / handleSpearAttacks / abortAttack

**What:** Wire the three weapon attack functions in PlayerMoveContext.

**Real functions:** `handleWhipAttacks()`, `handleSpearAttacks()`, `abortAttack()` in `movement/weapon-attacks.ts`

**DI requirement:** `WeaponAttackContext` with bolt system helpers (for whip reach), targeting helpers, damage resolution.

### 2b: cloneMonster (port + wire)

**What:** Port `cloneMonster()` from Monsters.c:559 (~60 lines) and wire in RunicContext and CombatHelperContext.

**C source:** Deep-copies a creature, optionally places the clone on the map, handles carried monster recursion, sets bookkeeping flags.

**Impact:** Jelly splitting, plenty runic, multiplicity armor all depend on this.

### 2c: forceWeaponHit (port + wire)

**What:** Port `forceWeaponHit()` from Combat.c:498 (~30 lines) and wire in RunicContext.

**C source:** Implements the force weapon's teleport-to-target (blink) effect during melee combat.

### 2d: monsterStealsFromPlayer (port + wire)

**What:** Port monkey/thief item-stealing behavior (~50 lines) and wire in RunicContext.

### 2e: teleport (port + wire)

**What:** Port `teleport()` from Monsters.c:1146 (~80 lines) and wire in CreatureEffectsContext.

**C source:** Moves a creature to a target position (or random safe position), handles pathfinding for terrain-avoidance, updates map flags.

---

## Phase 3: World Simulation

After this phase, the dungeon feels alive — monsters spawn over time, AI plans retreat, clairvoyance reveals the map, and floor items decay.

### 3a: spawnPeriodicHorde (1 context)

**What:** Wire `spawnPeriodicHorde()` in CreatureEffectsContext.

**Real function:** `spawnPeriodicHorde()` in `monsters/monster-spawning.ts`

**DI requirement:** `SpawnContext` with horde catalog, monster generation, map placement.

### 3b: updateSafetyMap (1 context)

**What:** Wire `updateSafetyMap()` from `safety-maps.ts`.

### 3c: updateClairvoyance (1 context)

**What:** Wire `updateClairvoyance()` from `safety-maps.ts`.

### 3d: updateFloorItems (port + wire)

**What:** Port `updateFloorItems()` from Items.c:1192 (~50 lines) — floor item decay, fire damage to items.

### 3e: assureCosmeticRNG / restoreRNG (implement + wire)

**What:** Implement RNG stream switching (~10 lines) to isolate cosmetic randomness from substantive gameplay RNG. Wire in the 3 contexts that currently stub these.

---

## Technical Notes

### MonsterStateContext Pattern

`monsterAvoids` needs a `MonsterStateContext` with ~15 fields. Since it's wired in 8 places, build a shared `buildMonsterStateContext()` helper (similar to the existing `buildMessageOps()` pattern) that can be spread into each context.

### moveCursor Porting Strategy

`moveCursor` in C is in Items.c (confusingly — it's the cursor/input system, not item logic). The function is a synchronous loop in C that calls `nextBrogueEvent` for blocking input. In the TS async architecture, this needs to become an async function that `await`s `nextBrogueEvent`. The existing stub shows this pattern — it calls `browserConsole.nextKeyOrMouseEvent()` synchronously. The real implementation should use the async `waitForEvent()` path.

### Incremental Testability

- After Phase 1: Start a new game → move around → use stairs → see path preview on mouse hover → eat food
- After Phase 2: Fight jellies that split → see whip reach attacks → watch monkeys steal items
- After Phase 3: See monsters spawn over time → clairvoyance ring reveals map → floor items decay

---

## Open Questions

- **moveCursor async boundary:** The C function is synchronous with blocking I/O. The TS InputContext already uses async patterns for `mainInputLoop`. Need to verify `moveCursor` integrates cleanly with the existing async event dispatch.
- **MonsterStateContext scope:** `monsterAvoids` is called from hot paths (pathfinding cost maps). Need to ensure the context builder isn't too expensive if called repeatedly. May want to cache or lift the context above the hot loop.
- **teleport pathfinding:** `teleport()` in C calls `getQualifyingPathLocNear` which may have its own dependencies. Need to trace the full call chain.
