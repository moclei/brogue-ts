# Audit: Items.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** c-inventory.md captured 56 static functions; Items.c has ~78 additional public
functions found via targeted grep. Multi-line signature issue confirmed (same as IO.c). Total
audited: ~134. Coverage is broadly strong — most core item/inventory/naming/equipment logic is
IMPLEMENTED with tests. The main gaps are in bolt/zap mechanics (zap, detonateBolt, throwItem,
hiliteTrajectory, moveCursor/nextTargetAfter/chooseTarget cursor stubs), several C-private helpers
that have no TS equivalents (negate, weaken, slow, polymorph, enchant-swap group), and a cluster
of items.ts context stubs without test.skip entries.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| initializeItem | 34 | items/item-generation.ts:243 | IMPLEMENTED | |
| generateItem | 75 | items/item-generation.ts:553 | IMPLEMENTED | |
| pickItemCategory | 81 | items/item-generation.ts:196 | IMPLEMENTED | static |
| getHallucinatedItemCategory | 111 | items/item-generation.ts:630 | IMPLEMENTED | |
| getItemCategoryGlyph | 119 | items/item-generation.ts:115 | IMPLEMENTED | |
| itemIsHeavyWeapon | 166 | items/item-generation.ts:586 | IMPLEMENTED | |
| itemIsPositivelyEnchanted | 174 | items/item-generation.ts:598 | IMPLEMENTED | |
| makeItemInto | 179 | items/item-generation.ts:280 | IMPLEMENTED | |
| chooseKind | 409 | items/item-generation.ts:222 | IMPLEMENTED | |
| placeItemAt | 422 | — | MISSING | Context slot in lifecycle.ts:353 (`() => {}`); no standalone export |
| fillItemSpawnHeatMap | 463 | items/item-population.ts:124 | IMPLEMENTED | static; inlined as private function within populateItems module |
| coolHeatMapAt | 484 | items/item-population.ts:162 | IMPLEMENTED | static; inlined as private function within populateItems module |
| getItemSpawnLoc | 508 | items/item-population.ts | IMPLEMENTED | static; inlined within populateItems module |
| populateItems | 537 | items/item-population.ts:240 | IMPLEMENTED | wired in lifecycle.ts |
| itemWillStackWithPack | 806 | items/item-inventory.ts:221 | IMPLEMENTED | static |
| removeItemAt | 823 | — | MISSING | Not found in rogue-ts/src/; no stub or context slot |
| pickUpItemAt | 836 | movement.ts:291 | STUBBED-TRACKED | `() => {}` in movement.ts; movement.test.ts:223 test.skip |
| addItemToPack | 971 | items/item-inventory.ts:253 | IMPLEMENTED | |
| numberOfItemsInPack | 1020 | items/item-inventory.ts:83 | IMPLEMENTED | |
| nextAvailableInventoryCharacter | 1029 | items/item-inventory.ts:145 | IMPLEMENTED | |
| checkForDisenchantment | 1051 | items/item-inventory.ts:317 | IMPLEMENTED | |
| itemIsSwappable | 1075 | items/item-inventory.ts:307 | IMPLEMENTED | static |
| swapItemToEnchantLevel | 1085 | — | MISSING | static; enchant-swap mechanic not ported |
| enchantLevelKnown | 1142 | — | MISSING | static; enchant-swap helper |
| effectiveEnchantLevel | 1152 | — | MISSING | static; enchant-swap helper |
| swapItemEnchants | 1160 | — | MISSING | static; enchant-swap mechanic not ported |
| itemCanBeCalled | 1314 | — | MISSING | Predicate for showing "call" option in menu; not found in TS |
| call | 1325 | ui.ts:320 | STUBBED-TRACKED | `async () => {}` in ui.ts; ui.test.ts:331 test.skip covers all inventory commands |
| itemName | 1426 | items/item-naming.ts:189 | IMPLEMENTED | |
| conflateItemCharacteristics | 926 | items/item-inventory.ts:171 | IMPLEMENTED | static |
| stackItems | 945 | items/item-inventory.ts:202 | IMPLEMENTED | static |
| inventoryLetterAvailable | 956 | items/item-inventory.ts:127 | IMPLEMENTED | static |
| inscribeItem | 1292 | — | MISSING | static; internal logic for item-calling (relabel dialog); no TS equivalent |
| itemKindName | 1717 | items/item-naming.ts:123 | IMPLEMENTED | |
| itemRunicName | 1744 | items/item-naming.ts:151 | IMPLEMENTED | |
| enchantMagnitude | 1760 | items/item-usage.ts:209 | IMPLEMENTED | static |
| enchantIncrement | 1814 | items/item-usage.ts:185 | IMPLEMENTED | static |
| effectiveRingEnchant | 1839 | items/item-usage.ts:137 | IMPLEMENTED | static |
| apparentRingBonus | 1850 | items/item-usage.ts:155 | IMPLEMENTED | static |
| monsterClassHasAcidicMonster | 1869 | — | MISSING | static; used in item degradation logic |
| isVowelish | 1789 | items/item-naming.ts:104 | IMPLEMENTED | |
| itemIsCarried | 1828 | items/item-naming.ts:713 | IMPLEMENTED | |
| itemDetails | 1879 | — | MISSING | Context interface slot in sidebar-player.ts:131; no implementation found |
| displayInventory | 2770 | io/inventory-display.ts:52 | IMPLEMENTED | async in TS |
| displayMagicCharForItem | 2761 | io/inventory.ts:168 | IMPLEMENTED | static |
| numberOfMatchingPackItems | 3132 | items/item-inventory.ts:99 | IMPLEMENTED | |
| updateEncumbrance | 3167 | items/item-usage.ts:351 | IMPLEMENTED | tested in item-usage.test.ts:518; items.ts has a `() => {}` context stub (DI pattern normal) |
| armorValueIfUnenchanted | 3188 | items/item-usage.ts:223 | IMPLEMENTED | |
| displayedArmorValue | 3195 | items/item-usage.ts:248 | IMPLEMENTED | |
| strengthCheck | 3203 | items/item-usage.ts:380 | IMPLEMENTED | |
| equip | 3232 | ui.ts:315 | STUBBED-TRACKED | `async () => {}` in ui.ts; ui.test.ts:331 test.skip covers all inventory commands |
| keyInPackFor | 3320 | movement.ts:278 | NEEDS-VERIFICATION | Context slot injected in movement.ts:278; no standalone export — verify implementation |
| keyOnTileAt | 3331 | time/environment.ts:87 | NEEDS-VERIFICATION | Context slot in time modules; no standalone export — verify implementation |
| aggravateMonsters | 3358 | items.ts:208 | STUBBED-TRACKED | `() => {}` in items.ts; items.test.ts:219 test.skip |
| getLineCoordinates | 3415 | items/bolt-geometry.ts:83 | IMPLEMENTED | |
| getImpactLoc | 3569 | items/bolt-geometry.ts:178 | IMPLEMENTED | |
| keyMatchesLocation | 3305 | — | MISSING | static; key-door matching predicate; no TS equivalent found |
| impermissibleKinkBetween | 3605 | — | MISSING | static; bolt path validation helper |
| tunnelize | 3631 | — | MISSING | static; bolt/spell tunneling logic |
| negationWillAffectMonster | 3690 | — | MISSING | static; predicate for negation bolt effects |
| negate | 3734 | — | MISSING | Main negation spell effect; negateCreatureStatusEffects in monster-actions.ts is a partial analogue but not a direct port |
| weaken | 3827 | — | MISSING | Weakness status application |
| slow | 3905 | — | MISSING | Slow status application |
| haste | 3919 | items.ts:199 | STUBBED-TRACKED | `() => {}` in items.ts; items.test.ts:209 test.skip |
| heal | 3933 | combat/combat-damage.ts:540 | IMPLEMENTED | exported; tested |
| projectileReflects | 4206 | — | MISSING | Projectile reflection predicate |
| reflectBolt | 4244 | items/bolt-geometry.ts:233 | IMPLEMENTED | |
| checkForMissingKeys | 4310 | movement.ts:292 | STUBBED-TRACKED | `() => {}` in movement.ts; movement.test.ts:229 test.skip |
| boltEffectForItem | 4337 | — | MISSING | Maps item to bolt effect enum |
| boltForItem | 4345 | — | MISSING | Maps item to bolt type enum |
| zap | 4814 | — | MISSING | Main bolt-firing engine; largest MISSING function in Items.c |
| detonateBolt | 4720 | — | MISSING | static; bolt detonation on impact |
| itemMagicPolarityIsKnown | 5181 | — | MISSING | static; polarity reveal predicate |
| canAutoTargetMonster | 5197 | — | MISSING | static; auto-targeting eligibility |
| hiliteTrajectory | 5328 | — | MISSING | static; visual bolt path highlighting |
| pullMouseClickDuringPlayback | 5587 | — | OUT-OF-SCOPE | static; recording/playback feature; browser has no playback system |
| tryGetLastUnidentifiedItemKind | 5834 | items/item-naming.ts:456 | IMPLEMENTED | static |
| magicPolarityRevealedItemKindCount | 5855 | items/item-naming.ts:486 | IMPLEMENTED | static |
| tryIdentifyLastItemKind | 5881 | items/item-naming.ts:513 | IMPLEMENTED | static |
| tryIdentifyLastItemKinds | 5904 | items/item-naming.ts:542 | IMPLEMENTED | static |
| hitMonsterWithProjectileWeapon | 5999 | — | MISSING | static; projectile weapon combat |
| throwItem | 6080 | — | MISSING | static; core throw-item mechanic |
| playerCancelsBlinking | 6470 | items.ts:243 | STUBBED-UNTRACKED | `() => true` in items.ts; NO test.skip entry |
| recordApplyItemCommand | 6533 | items/item-handlers.ts:252 | IMPLEMENTED | static |
| useStaffOrWand | 6545 | items/item-handlers.ts:1030 | IMPLEMENTED | static |
| summonGuardian | 6651 | items.ts:216 | STUBBED-UNTRACKED | `() => {}` in items.ts; NO test.skip entry |
| consumePackItem | 6671 | items/item-handlers.ts:239 | IMPLEMENTED | static |
| useCharm | 6716 | items/item-handlers.ts:1130 | IMPLEMENTED | static |
| lotteryDraw | 6857 | — | MISSING | static; weighted-random draw helper |
| chooseVorpalEnemy | 6876 | lifecycle.ts:113 | NEEDS-VERIFICATION | private (non-exported) function in lifecycle.ts; verify signature matches C |
| describeMonsterClass | 6890 | — | MISSING | Used in item descriptions and vorpal name building |
| updateIdentifiableItem | 6908 | items.ts:185 | STUBBED-UNTRACKED | `() => {}` in items.ts; NO test.skip entry |
| updateIdentifiableItems | 6928 | items/item-handlers.ts:331 | IMPLEMENTED | |
| readScroll | 6957 | items/item-handlers.ts:447 | IMPLEMENTED | |
| magicMapCell | 6938 | items/item-handlers.ts:308 | IMPLEMENTED | static |
| uncurse | 6949 | items/item-handlers.ts:227 | IMPLEMENTED | static |
| detectMagicOnItem | 7225 | items/item-handlers.ts:294 | IMPLEMENTED | |
| eat | 6686 | items/item-handlers.ts:406 | IMPLEMENTED | |
| apply | 6793 | items/item-handlers.ts:1233 | IMPLEMENTED | |
| identify | 6845 | items/item-naming.ts:607 | IMPLEMENTED | |
| nextTargetAfter | 5281 | io/input-context.ts:230 | STUBBED-UNTRACKED | `() => false` context stub; NO test.skip entry |
| moveCursor | 5372 | io/input-context.ts:229 | STUBBED-UNTRACKED | `() => false` context stub; NO test.skip entry |
| chooseTarget | 5607 | items.ts:241 | STUBBED-UNTRACKED | context stub returning invalid pos; NO test.skip entry |
| itemKindCount | 5768 | items/item-naming.ts:396 | IMPLEMENTED | |
| identifyItemKind | 5921 | items/item-naming.ts:566 | IMPLEMENTED | |
| autoIdentify | 5968 | items/item-handlers.ts:263 | IMPLEMENTED | |
| throwCommand | 6284 | ui.ts:318 | STUBBED-TRACKED | `async () => {}` in ui.ts; ui.test.ts:331 test.skip |
| relabel | 6385 | ui.ts:319 | STUBBED-TRACKED | `async () => {}` in ui.ts; ui.test.ts:331 test.skip |
| swapLastEquipment | 6441 | io/input-context.ts:202 | STUBBED-UNTRACKED | `() => {}` in input-context.ts; NO test.skip entry |
| magicCharDiscoverySuffix | 7411 | items/item-handlers.ts:349 | IMPLEMENTED | |
| itemMagicPolarity | 7465 | items/item-generation.ts:609 | IMPLEMENTED | |
| unequip | 7500 | ui.ts:316 | STUBBED-TRACKED | `async () => {}` in ui.ts; ui.test.ts:331 test.skip |
| canDrop | 7541 | — | MISSING | static; predicate checks if player can drop equipped/cursed items |
| drop | 7548 | ui.ts:317 | STUBBED-TRACKED | `async () => {}` in ui.ts; ui.test.ts:331 test.skip |
| dropItem | 7652 | — | MISSING | Context slot in time/creature-effects.ts:115; no standalone export |
| recalculateEquipmentBonuses | 7687 | items/item-usage.ts:265 | IMPLEMENTED | |
| equipItem | 7718 | items/item-usage.ts:418 | IMPLEMENTED | pure equipment logic (without UI interaction) |
| unequipItem | 7807 | items/item-usage.ts:506 | IMPLEMENTED | pure equipment logic (without UI interaction) |
| updateRingBonuses | 7852 | items/item-usage.ts:304 | IMPLEMENTED | |
| updatePlayerRegenerationDelay | 7903 | items.ts:238 | STUBBED-UNTRACKED | `() => {}` in items.ts; NO test.skip entry |
| removeItemFromChain | 7919 | items/item-inventory.ts:25 | NEEDS-VERIFICATION | renamed to removeItemFromArray in TS; verify behavior is equivalent |
| addItemToChain | 7933 | items/item-inventory.ts:41 | NEEDS-VERIFICATION | renamed to addItemToArray in TS; verify behavior is equivalent |
| deleteItem | 7938 | — | MISSING | Context stub `() => {}` in lifecycle.ts:353 and turn.ts:83; no standalone export |
| shuffleFlavors | 7949 | items/item-naming.ts:638 | IMPLEMENTED | |
| resetItemTableEntry | 7942 | items/item-naming.ts:625 | IMPLEMENTED | static |
| itemValue | 8028 | items/item-naming.ts:700 | IMPLEMENTED | |
| itemOfPackLetter | 7625 | items/item-inventory.ts:64 | IMPLEMENTED | |
| itemAtLoc | 7635 | items/item-inventory.ts:50 | IMPLEMENTED | |
| makePlayerTelepathic | 3976 | items.ts:203 | STUBBED-UNTRACKED | static; `() => {}` in items.ts; NO test.skip entry |
| rechargeItems | 3989 | items.ts:225 | STUBBED-UNTRACKED | static; `() => {}` in items.ts; NO test.skip entry; distinct from rechargeItemsIncrementally (Time.c) |
| negationBlast | 4073 | items.ts:226 | STUBBED-TRACKED | static; `() => {}` in items.ts; items.test.ts:229 test.skip |
| discordBlast | 4129 | items.ts:227 | STUBBED-UNTRACKED | static; `() => {}` in items.ts; NO test.skip entry |
| crystalize | 4150 | items.ts:224 | STUBBED-TRACKED | static; `() => {}` in items.ts; items.test.ts:224 test.skip |
| imbueInvisibility | 4187 | items.ts:204 | STUBBED-UNTRACKED | static; `() => {}` in items.ts; NO test.skip entry |
| beckonMonster | 4322 | — | MISSING | static; monster-attraction mechanic (charm/wand) |
| updateFloorItems | 1192 | — | MISSING | Context interface slot only in time modules; no standalone export or implementation found |
| promptForItemOfType | 7586 | items.ts:177 | STUBBED-TRACKED | `() => null` in items.ts; items.test.ts:197 test.skip |
| polymorph | 3841 | — | MISSING | static; polymorphism spell logic |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 73 |
| STUBBED-TRACKED | 11 |
| STUBBED-UNTRACKED | 12 |
| MISSING | 28 |
| NEEDS-VERIFICATION | 5 |
| OUT-OF-SCOPE | 1 |
| DATA-ONLY | 0 |
| **Total** | **130** |

## Critical Gaps

MISSING and STUBBED-UNTRACKED items ordered by gameplay impact:

1. `zap` — **Highest impact.** The main bolt-firing engine. All staves, wands, and ranged scrolls depend on it. Without it, no bolt effects can fire, which breaks staves, wands, and most scroll effects.
2. `detonateBolt` — Direct dependency of `zap`; handles bolt impact. MISSING together they mean the entire bolt subsystem is absent.
3. `throwItem` — Throwing weapons is a core mechanic. Entire throw workflow (`throwCommand` → `throwItem`) is broken.
4. `hitMonsterWithProjectileWeapon` — Sub-routine of `throwItem`; handles thrown weapon combat math.
5. `boltEffectForItem` / `boltForItem` — Item-to-bolt-type mapping used by `zap` and `useStaffOrWand`. `useStaffOrWand` is IMPLEMENTED but may be calling a stub.
6. `negate` / `weaken` / `slow` — Core spell status effects. Negation wands/scrolls, slow rings, weakness effects all depend on these.
7. `polymorph` — Polymorphism scroll/spell. Major item effect missing.
8. `placeItemAt` — Floor item placement. Used during level generation and item drops. Context stub `() => {}` in lifecycle.ts breaks all item placement.
9. `deleteItem` — Item deletion (consumed items, destroyed items). Context stubs in lifecycle.ts and turn.ts; no implementation means items are never freed.
10. `updateFloorItems` — Called each turn to check items on floor for effects. Context interface slot with no implementation.
11. `dropItem` — Monster/player item drop. Context slot with no implementation.
12. `hiliteTrajectory` — Visual bolt path display. Affects all targeting UI feedback.
13. `moveCursor` / `nextTargetAfter` / `chooseTarget` — Targeting cursor system. All three are context stubs. Without them, targeting mode is non-functional.
14. `playerCancelsBlinking` — Currently always returns `true`, meaning blink wands always cancel. STUBBED-UNTRACKED.
15. `inscribeItem` — Item calling (player-naming) logic. `relabel` dialog is STUBBED-TRACKED but this internal function is absent.
16. `swapItemToEnchantLevel` / `swapItemEnchants` / `enchantLevelKnown` / `effectiveEnchantLevel` — Enchant-swap mechanic (weapon/armor ring of enchant-swapping). 4 functions missing as a group.
17. `makePlayerTelepathic` / `imbueInvisibility` / `discordBlast` / `rechargeItems` / `summonGuardian` / `updateIdentifiableItem` / `updatePlayerRegenerationDelay` / `swapLastEquipment` — Context stubs without test.skip. Rule violations.
18. `removeItemAt` / `keyMatchesLocation` / `monsterClassHasAcidicMonster` / `canDrop` / `describeMonsterClass` / `beckonMonster` / `negationWillAffectMonster` / `impermissibleKinkBetween` / `tunnelize` / `lotteryDraw` / `itemCanBeCalled` / `projectileReflects` / `itemMagicPolarityIsKnown` / `canAutoTargetMonster` / `itemDetails` / `dropItem` — Smaller MISSING functions, several are static helpers that may be inlinable; others (itemDetails, itemCanBeCalled) are needed for sidebar and menu behavior.

## Notes for follow-on initiative

- **`zap` is the keystone for Items.c.** Implementing it requires `detonateBolt`, `boltEffectForItem`, `boltForItem`, `hiliteTrajectory`, `moveCursor`, `nextTargetAfter`, `chooseTarget`. All are absent — this is a substantial porting effort.
- `placeItemAt` and `deleteItem` context stubs are likely causing silent failures during level generation and item consumption even now. These should be prioritized alongside `displayLevel`.
- The enchant-swap group (`swapItemToEnchantLevel`, `swapItemEnchants`, etc.) is a self-contained mechanic that can be ported in isolation.
- `removeItemFromArray`/`addItemToArray` rename from C's `removeItemFromChain`/`addItemToChain` — these should be verified to ensure the linked-list semantics match (TS uses arrays, C uses a singly-linked list).
- `chooseVorpalEnemy` at lifecycle.ts:113 is private and non-exported — worth checking against C signature to confirm it is complete.
- `negate`, `weaken`, `slow` are spell-effect primitives called from many locations. `negateCreatureStatusEffects` in monster-actions.ts partially covers `negate` but likely doesn't cover the item-degradation part.
- The 12 STUBBED-UNTRACKED entries need `test.skip` added during the synthesis phase.
