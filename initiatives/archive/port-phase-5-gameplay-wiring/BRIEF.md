# Phase 5: Gameplay Wiring

## Intent
Connect the ~160+ remaining runtime stubs in `runtime.ts` to their real implementations and port ~7 missing functions so the TypeScript port becomes a fully playable game. All game logic was ported in Phases 0–3 and the DI skeleton was wired in Phase 4. This phase replaced no-op stubs with calls to the real functions, giving the player feedback, interaction, and a complete gameplay loop from depth 1 through depth 26.

This initiative unifies two earlier efforts that were tracked separately:
- `wire-gameplay-systems` — wired ~148 stubs across 6 phases (messages, item interaction, monster lifecycle, combat effects, UI panels, polish)
- `complete-gameplay-wiring` — wired the final ~16 actionable stubs and ported ~7 missing functions (monsterAvoids, startLevel, eat, moveCursor, cloneMonster, teleport, etc.)

## Goals
- Player sees text feedback for all actions (combat, movement, item use, environment)
- Player can pick up, equip, use, drop, and throw items
- Monsters die properly, drop loot, trigger tile effects
- Monsters respect terrain hazards (lava, chasms, deep water, traps)
- Stairs work — player can descend and ascend between levels
- Food consumption, equipment bonuses, HP regeneration all function correctly
- Mouse hover shows path preview and cell descriptions
- Whip, spear, and force weapons have their signature attack behaviors
- Monster cloning, stealing, teleportation work
- Sidebar, inventory screen, and flavor text are functional
- Weapon/armor runics, special hits, and feats all trigger correctly
- Periodic monster spawning, safety maps, clairvoyance, floor item decay work

## Scope

What was in:
- Wire message system (~47 stubs across 12+ DI contexts)
- Wire item interaction (~20 stubs: pickUp, equip, unequip, drop, apply, throw, itemName, etc.)
- Wire monster lifecycle (~15 stubs: killCreature, removeCreature, spawnDungeonFeature, promoteTile, etc.)
- Wire combat effects (~10 stubs: weapon/armor runics, feats, recharge)
- Wire UI panels (~10 stubs: refreshSideBar, displayInventory, flavor text, info screens)
- Wire polish (~15 stubs: search, miner's light, underwater effects, flares, recording hooks)
- Wire 9 ported-but-not-wired functions (monsterAvoids ×8, startLevel, eat, recalculateEquipmentBonuses, weapon attacks, updateSafetyMap, updateClairvoyance, spawnPeriodicHorde)
- Port and wire 7 not-yet-ported functions (cloneMonster, teleport, forceWeaponHit, monsterStealsFromPlayer, updateFloorItems, updatePlayerRegenerationDelay, cosmeticRNG)
- Port and wire moveCursor (~150 lines) for mouse hover interaction

What was out:
- Save/load (needs IndexedDB/localStorage backend)
- Debug/wizard-mode displays (cosmetic, low priority)
- Recording playback system (separate verification concern)
- Main menu performance optimization
- New gameplay features or balance changes

## Constraints
- No changes to game logic — ported functions must match C behavior
- DI context pattern preserved (no global state)
- TypeScript strict mode throughout
- All existing tests continued to pass at each step
