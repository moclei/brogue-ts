# SESSIONS: port-v2-playtest — Phase 8 Bug Tracker

Each browser playtest session finds bugs, fixes them, and updates this file.
New sessions: read the Bug Tracker table first, then the last session entry.

---

## Bug Tracker

| ID | Description | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| B1 | Vegetation (grass/foliage/fungus) not visible on dungeon floors | Medium | Open | `runAutogenerators` is implemented; likely drawPriority mismatch — either `fillSpawnMap` DFF_BLOCKED_BY_OTHER_LAYERS check fails, or grass written to pmap but loses to FLOOR in getCellAppearance rendering loop. Check drawPriority for FLOOR vs GRASS in `globals/tile-catalog.ts` vs C source. |
| B2 | Monsters can't hit player — no damage, no incoming combat messages | HIGH | Open | Blocks death screen verification. Monsters wake, move toward player, player can kill them. Attack path from monster → player is broken. Trace `monstersTurn()` in `turn-processing.ts` to find what context fn handles monster→player melee; check if stubbed in `turn.ts`. |
| B3 | All potions appear yellow; "it must have been a yellow potion" on use | Medium | Open | Potion effects do work (telepathic status observed). Likely `shuffleFlavors` not running or the shuffled table isn't the one `itemName` reads. Check `shuffleFlavors` call in `buildGameInitContext()` (`lifecycle.ts`) and verify `mutablePotionTable` is consistent end-to-end. |
| B4 | Pickup message says "You now have item (e)" regardless of item type | Medium | Open | Pack letter correct; name wrong. `itemName` likely stubbed in `movement.ts` `buildMovementContext` / `buildPlayerMoveContext`. Inventory dialog correctly differentiates types — only pickup message path broken. |
| B5 | Player cannot fall down chasms | Low | Deferred | `applyInstantTileEffectsToCreature` stubbed. Same root cause as monster-on-chasm note (session 2026-03-09d). Permanent defer this initiative. |

---

## Session Log

### Session 2026-03-09f — browser playtest; 5 bugs found (B1–B5)

- **Observed:** Playtest after death/victory screen commit (4caf6aa). Monsters spawn and move
  toward player. Player can attack and kill monsters. Stair descent, travel/auto-explore,
  help/discoveries overlays all working.
- **Bugs found:** B1 (vegetation missing), B2 (monsters can't hit player), B3 (all potions
  yellow), B4 (pickup message generic), B5 (chasms — already known).
- **Fixed:** Nothing this session — investigating and documenting.
- **Next:** Fix B2 first (highest priority, blocks death screen test). Then B4 (small, contained).
  Then B3. Then B1.

---

### Session 2026-03-09e — death/victory screen wired; runAutogenerators verified

- **Fixed:** `setVictory()` + `takePendingVictory()` added to `core.ts`; `victory` stub in
  `movement.ts` wired; `showGameEndScreen()` added to `menus.ts`, called after `mainGameLoop()`
  exits. Commit: 4caf6aa. Also: verified `runAutogenerators` already fully implemented in
  `machines.ts:1902` — prior handoff was incorrect.

---

### Session 2026-03-09d — combat messages, monster movement, spawn locations

- **Fixed:** `displayCombatText` wired in `turn.ts`; `currentStealthRange: () => 14` in
  `buildTurnProcessingContext`; `spawnHorde` arg order fixed (liquidType/terrainType transposed).
  Commit: a80213f.

---

### Sessions 2026-03-08 through 2026-03-09c — build clean through monster spawning

Key fixes across 10 sessions: tsc errors resolved (a54ed43); `updateVision` wired in all
three context builders; `commitDraws` added to `mainGameLoop`; `refreshSideBar` wired in
`buildInputContext`; `updateMinersLightRadius` wired (fog of war fixed); message functions
and display buffer ops wired in `buildInputContext`; `InventoryContext` expanded to 32
fields; `displayInventory` wired; overlay write-back fixed (`applyOverlay`);
`printCarriedItemDetails` implemented with action buttons; stair descent wired (`cfdbde1`);
auto-explore wired (`9081a89`); per-step animation fixed (`a54151a`); help/discoveries
overlays working (`51e1631`, `6ab58e4`); `randomMatchingLocation` + `passableArcCount`
stubs replaced — monsters now spawn correctly (`eee9a74`).
