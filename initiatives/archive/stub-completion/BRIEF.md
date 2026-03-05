# Stub Completion

## Intent

Clear every known stub, simplified implementation, and no-op from the TypeScript port so the game reaches a genuinely playable state — all core mechanics working, no "coming soon" placeholders blocking gameplay.

## Goals

- Item apply works: scrolls, potions, food, staffs, wands, and charms all produce their full effects
- Monster AI uses the full ported `monstersTurn()` — ranged attacks, fleeing, special abilities, ally behavior
- Lighting system active: dynamic light from torches, lava, glowing creatures updates each turn
- Fog-of-war working: cells lose visibility when out of FOV, `rememberedAppearance` stores last-seen state
- Health and hunger alerts fire at correct thresholds
- Confirm dialogs prompt the player instead of silently returning `true`
- Level persistence: monsters and items from previous levels restored on revisit
- Remaining item actions (relabel, call, swap) functional

## Scope

**In:**
- All stubs in `docs/STUBS_SNAPSHOT.md` except the deliberate deferrals below
- Port bolt catalog from C's `GlobalsBrogue.c`
- Port missing context methods for MonstersTurnContext and ItemHandlerContext
- Implement scent map updates, `storeMemories()`, `demoteVisibility()`, `handleHealthAlerts()`
- Implement `restoreMonster()` / `restoreItems()` in architect.ts
- Implement `relabel()` / `call()` text input, ring `swap()`

**Out (deliberate deferrals):**
- Save/Load — needs IndexedDB/localStorage backend; separate initiative
- Recordings/Playback — complete subsystem; separate initiative
- Debug displays (`displayGrid`, `displayLoops`, `displayChokeMap`, `displayMachines`, `displayWaypoints`) — developer tools only
- `funkyFade()` animation — aesthetic only, game is playable without it
- `zap()` bolt function — the actual bolt projectile animation; staffs/wands will fire but no projectile visual yet

## Constraints

- All existing 2,264 tests must continue to pass after each phase
- No compilation errors at any commit point
- Follow existing DI context-builder pattern in `runtime.ts`
