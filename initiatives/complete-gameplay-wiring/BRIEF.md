# Complete Gameplay Wiring

## Intent
Wire the ~16 remaining actionable runtime stubs to real implementations and port the ~7 missing functions so the TypeScript port becomes a fully playable game from depth 1 through depth 26. This initiative covers the final gap between "most systems work" and "a player can complete a full run."

## Goals
- Monsters respect terrain hazards (lava, chasms, deep water, traps)
- Stairs work — the player can descend and ascend between levels
- Food consumption functions — starvation mechanic is operational
- Equipment bonuses refresh correctly on equip/unequip
- Mouse hover shows path preview and cell descriptions (moveCursor)
- Whip, spear, and force weapons have their signature attack behaviors
- Monster cloning (jelly splits, plenty runic, multiplicity armor) works
- Teleportation, thief-stealing, and floor item decay are functional
- Periodic monster spawning keeps deeper levels dangerous
- Safety maps and clairvoyance ring work correctly

## Scope

What's in:
- Wire 9 ported-but-not-wired functions (monsterAvoids ×8 contexts, startLevel, eat, recalculateEquipmentBonuses, weapon attacks, updateSafetyMap, updateClairvoyance, spawnPeriodicHorde)
- Port and wire 7 not-yet-ported functions (cloneMonster, teleport, forceWeaponHit, monsterStealsFromPlayer, updateFloorItems, updatePlayerRegenerationDelay, cosmeticRNG)
- Port and wire moveCursor (~150 lines from Items.c) for mouse hover interaction

What's out:
- Save/load (needs IndexedDB/localStorage backend — separate initiative)
- Debug/wizard-mode displays (cosmetic, low priority)
- Recording playback system (separate verification concern)
- restoreMonster (only needed for save/load)
- Main menu performance optimization (separate initiative)
- New gameplay features or balance changes

## Constraints
- No changes to game logic — ported functions must match C behavior
- DI context pattern must be preserved (no global state)
- TypeScript strict mode throughout
- All existing 2,263 tests must continue to pass
- Each phase should leave the game in a more playable state than before
