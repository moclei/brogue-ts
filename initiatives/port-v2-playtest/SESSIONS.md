# SESSIONS: port-v2-playtest — Phase 8 Bug Tracker

Each browser playtest session finds bugs, fixes them, and updates this file.
New sessions: read the Bug Tracker table first, then the last session entry.

---

## Bug Tracker

| ID | Description | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| B1 | Vegetation (grass/foliage/fungus) not visible on dungeon floors | Medium | Fixed (729bcb2, verified) | Fixed as side effect of `initializeGameVariant` call — that function sets `gameConst.numberAutogenerators`, which was 0 before, causing autogenerators (grass/foliage) to not populate at all. |
| B2 | Monsters can't hit player — no damage, no incoming combat messages | HIGH | Fixed (61beabf) | Root: `attack: () => {}` stub in `MoveMonsterContext` (turn-monster-ai.ts line 286). Wired `attackFn`+`buildHitListFn` from `combat/combat-attack.ts` via `buildCombatAttackContext()`. |
| B3 | All potions appear yellow AND are all telepathy potions | Medium | Fixed (729bcb2, verified) | Root: (1) `initializeGameVariant` no-op → `numberPotionKinds=0` → shuffle loop ran 0 times; (2) `mutablePotionTable` shallow copy — flavor sync to mutableXxxTable added in lifecycle.ts. |
| B4 | Pickup message says "You now have item (e)" regardless of item type | Medium | Fixed (61beabf) | Root: `itemName: () => buf[0]="item"` stubs in `movement.ts` (×2) and `turn.ts` (×1). Wired real `itemNameFn` from `items/item-naming.ts` with proper `ItemNamingContext`. |
| B5 | Player cannot fall down chasms — vision freezes, game enters broken state | Low | Deferred | `applyInstantTileEffectsToCreature` stubbed. Player can still move but vision stops updating (unseen areas stay unseen permanently). Permanent defer this initiative. |
| B6 | All scrolls display as 'A scroll entitled ""' (empty faux-word title) | Medium | Fixed (729bcb2, verified) | Same root as B3 (both causes fixed together). |
| B7 | Player can walk on water as if it were normal ground | Medium | Fixed (785c941) | Root: `applyGradualTileEffectsToCreature: () => {}` stub in `turn.ts`. Wired real impl with `gradualCtx`. NOTE: visual water-entry effect (light dimming) depends on `displayLevel` stub — see B9. |
| B8 | Pit bloat explosion does not open a chasm in the ground | Low | Fixed (cd6dfcc) | Wired real `spawnDungeonFeatureFn` into all four stubs: `combat.ts:buildCombatDamageContext` (CombatDamageContext featureIndex-based), `turn.ts:buildMinimalCombatContext` (same), `turn.ts:buildTurnProcessingContext` (TurnProcessingContext DungeonFeature-based), `turn-monster-ai.ts:buildMonstersTurnContext` (MonstersTurnContext dfType-based). |
| B9 | Water entry has no visual effect (light change / level re-render) | Low | Deferred | `updatePlayerUnderwaterness` sets `rogue.inWater` correctly but calls `displayLevel()` which is a permanent stub. Deferred same class as B5. |
| B10 | Inventory only shows pack items; equipped items section missing | Medium | Fixed (95bb5ac) | Root: `equipItem` wrappers in lifecycle.ts/combat.ts/items.ts/input-context.ts called `syncEquipBonuses` after `equipItemFn` — only syncs ring bonuses, not weapon/armor/ring refs. `rogue.weapon` etc. always null. Fix: all four wrappers now call `syncEquipState` instead. |
| B11 | Using a scroll/potion shows unidentified name in "It must have been..." message | Medium | Fixed (b373f3e) | Root: `identifyItemKind` wrote `identified=true` to catalog tables but `itemName` reads mutable copies. Fix: added optional `MutableFlavorTables` param to `identifyItemKind`/`identify`/`tryIdentifyLastItemKind`/`tryIdentifyLastItemKinds`; syncs `identified` to mutable entry after writing catalog. All call sites updated. |

---

## Session Log

### Session 2026-03-09k — fix B8 (monster death DF not spawning)

- **Fixed B8 (cd6dfcc):** Wired real `spawnDungeonFeatureFn` (from `architect/machines.ts`) into
  all four `spawnDungeonFeature: () => {}` stubs across `combat.ts`, `turn.ts` (×2), and
  `turn-monster-ai.ts`. Primary fix path: `killCreature` in `combat-damage.ts` checks
  `MA_DF_ON_DEATH` and calls `ctx.spawnDungeonFeature(DFType, 100, false)` — was a no-op.
  CombatDamageContext interface uses featureIndex + probability (scales `startProbability` for
  blood; probability=100 passes catalog feature unchanged for death DFs).
  Also wired TurnProcessingContext (DungeonFeature object) and MonstersTurnContext (dfType index)
  for per-turn `DFChance` features.
- **Commit:** cd6dfcc — 87 files, 2208 pass, 98 skip (no change in counts).
- **Next:** B9 (water visual effect — displayLevel stub) remains deferred. No other open bugs.
  Phase 9 (stub cleanup) is next.

---

### Session 2026-03-09j — fix B11 (identified name in autoIdentify message)

- **Fixed B11 (b373f3e):** `identifyItemKind` wrote `identified=true` to catalog tables but
  `itemName` reads mutable copies (same architectural split as B3/B6). Added optional
  `MutableFlavorTables` param to `identifyItemKind`, `identify`, `tryIdentifyLastItemKinds`,
  `tryIdentifyLastItemKind` in `item-naming.ts`. After writing `identified=true` to catalog
  entry, `syncIdentifiedToMutable()` mirrors it to the mutable entry. Updated all call sites
  in `item-handlers.ts` (5 sites), `lifecycle.ts` (1), `movement.ts` (1). Two new tests added.
- **Fixed B10 (95bb5ac):** `equipItem` wrappers in lifecycle.ts/combat.ts/items.ts/input-context.ts
  called `syncEquipBonuses` after `equipItemFn` — only syncs ring bonuses, never writes
  `rogue.weapon`/`rogue.armor`/rings back. `displayInventory` reads `ctx.rogue.weapon` etc.
  to build the equipped section, so it was always null/empty. Fix: all four wrappers now call
  `syncEquipState` instead.
- **Commit:** b373f3e (B11) + 95bb5ac (B10) — 87 files, 2208 pass, 98 skip.
- **Next:** B8 (pit bloat DF stub in buildMinimalCombatContext). B9 remains deferred.

---

### Session 2026-03-09i — fix B3+B6 (two-root bug) + B7 (water gradual effects); new B9+B10

- **Fixed B7 (785c941):** `applyGradualTileEffectsToCreature: () => {}` stub in `turn.ts`. Built inline
  `gradualCtx` covering deep-water item loss, terrain damage, terrain healing. Wired `dropItemFn`,
  `numberOfMatchingPackItemsFn`, `autoIdentifyFn`, `inflictDamageFn`, `killCreatureFn`.
  NOTE: `makeMonsterDropItem` stub remains — tracked in `test.skip` in `turn.test.ts`.
- **Fixed B3+B6 (this commit):** Two-root bug: (1) `initializeGameVariant` is a no-op stub in menus.ts
  so `gameConst.numberPotionKinds/numberScrollKinds = 0` when `shuffleFlavors` runs — loop does nothing.
  Fix: call `initializeGameVariant(ctx)` inside `game-init.ts:initializeRogue` before shuffleFlavors.
  (2) `mutablePotionTable`/`mutableScrollTable` are shallow copies — mutations to catalog arrays don't
  propagate. Fix: sync `itemColors[i]`/`itemTitles[i]` to mutableXxxTable in `lifecycle.ts` after shuffle.
  Earlier fix attempt (785c941) only addressed #2 (which was a no-op since loop ran 0 times).
- **Player-reported findings (requires re-test):** B9 (water visual effect — displayLevel stub, deferred),
  B10 (inventory equipped items missing).
- **Commit:** 729bcb2 — 87 files, 2206 pass, 98 skip (+1 for makeMonsterDropItem test.skip).
- **Next:** Re-test B3+B6 in browser. Then B10 (inventory equipped items). Then B8 or B1.

---

### Session 2026-03-09h — player playtest report; B6–B8 added

- **Player-reported findings after B2/B4 fixes:**
  - B3 clarified: all potions are specifically *telepathy* (kind 0) — confirms shuffleFlavors not
    running at all; unshuffled table used throughout.
  - B6 (new): all scrolls show empty title `'A scroll entitled ""'` — same shuffleFlavors root.
  - B7 (new): water walkable as normal ground — tile effects not applied on water tiles.
  - B5 extended: walking onto chasm puts game in broken state — player can still move but vision
    stops updating permanently; unseen areas never reveal. Root is still applyInstantTileEffectsToCreature
    stubbed; deferred.
  - B8 (new): pit bloat explosion doesn't open a chasm — monster death DF spawn not triggering.
- **Fixed:** Nothing this session — documenting findings.
- **Next:** Fix B3+B6 together (shuffleFlavors root). Then B7 (water walkability). Then B8
  (monster death DF). Then B1 (vegetation).

---

### Session 2026-03-09g — fix B2 (monster attack) + B4 (itemName)

- **Fixed B2:** `attack: () => {}` stub in `MoveMonsterContext` (turn-monster-ai.ts). Wired
  `attackFn` + `buildHitListFn` from `combat/combat-attack.ts` via `buildCombatAttackContext()`.
  Monsters can now deal damage to player; death screen path unblocked.
- **Fixed B4:** `itemName` stubs in `movement.ts` (×2) and `turn.ts` (×1) all returning "item".
  Wired real `itemNameFn` with full `ItemNamingContext` (mutablePotionTable, mutableScrollTable,
  wandTable, staffTable, ringTable, charmTable, monsterCatalog). Pickup message now shows item name.
- **Commit:** 61beabf — 87 files, 2206 pass, 97 skip.
- **Next:** B3 (all potions yellow — shuffleFlavors not wired or mutablePotionTable mismatch).
  Then B1 (vegetation missing — drawPriority/tile-catalog issue).

---

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
