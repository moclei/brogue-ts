# Wire Gameplay Systems

## Intent
Connect the ~148 remaining runtime stubs in `runtime.ts` to their real implementations so the TypeScript port becomes a playable game. All game logic was ported in Phases 0–3 and the DI skeleton was wired in Phase 4's Step 3. What remains is replacing no-op stubs with calls to the real functions, giving the player feedback, interaction, and a complete gameplay loop.

## Goals
- Player sees text feedback for all actions (combat, movement, item use, environment)
- Player can pick up, equip, use, drop, and throw items
- Monsters die properly, drop loot, trigger tile effects
- Sidebar shows HP, stats, and nearby entities
- Inventory screen is functional with button UI
- Save/load game works
- Manual search, encumbrance, miner's light, and status effects function correctly

## Scope

What's in:
- Wire message system (`message`, `messageWithColor`, `combatMessage`, `confirmMessages`, etc.)
- Wire item interaction (`pickUpItemAt`, `equip`, `unequip`, `drop`, `apply`, `throwCommand`, `itemName`)
- Wire monster lifecycle (`killCreature`, `removeCreature`, `moveMonster`, `splitMonster`, `makeMonsterDropItem`, `freeCaptive`)
- Wire terrain effects (`spawnDungeonFeature`, `promoteTile`, `applyInstantTileEffectsToCreature`)
- Wire combat effects (`magicWeaponHit`, `specialHit`, weapon/armor runics, feat tracking)
- Wire sidebar (`refreshSideBar`, `updateFlavorText`)
- Wire inventory display (`displayInventory`)
- Wire save/load (`saveGame`, `loadSavedGame`)
- Wire miscellaneous (`search`, `updateEncumbrance`, `updateMinersLightRadius`, `updatePlayerUnderwaterness`)

What's out:
- Recording playback (separate verification concern in Phase 4 Step 4b)
- Node.js terminal platform (Phase 4 Step 5)
- Debug/wizard-mode displays (`displayGrid`, `displayLoops`, etc.) — low priority cosmetic
- New gameplay features or balance changes
- Performance optimization

## Constraints
- No changes to game logic — the ported functions are the source of truth
- DI context pattern must be preserved (no global state)
- TypeScript strict mode throughout
- All existing tests must continue to pass
- Each phase should leave the game in a better-than-before playable state
