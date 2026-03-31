/*
 *  items/index.ts — barrel export for the items module
 *  brogue-ts
 */

export {
    initializeItem,
    generateItem,
    makeItemInto,
    pickItemCategory,
    chooseKind,
    getItemCategoryGlyph,
    getTableForCategory,
    getKindCountForCategory,
    itemIsThrowingWeapon,
    itemIsHeavyWeapon,
    itemIsPositivelyEnchanted,
    itemMagicPolarity,
    getHallucinatedItemCategory,
} from "./item-generation.js";

export type { ItemGenContext, ItemRNG } from "./item-generation.js";

export { populateItems } from "./item-population.js";

export type {
    PopulateItemsContext,
    PopulateItemsState,
} from "./item-population.js";

export {
    isVowelish,
    itemKindName,
    itemRunicName,
    itemName,
    itemKindCount,
    tryGetLastUnidentifiedItemKind,
    magicPolarityRevealedItemKindCount,
    tryIdentifyLastItemKind,
    tryIdentifyLastItemKinds,
    identifyItemKind,
    identify,
    resetItemTableEntry,
    shuffleFlavors,
    itemValue,
    itemIsCarried,
    itemColors,
    itemWoods,
    itemMetals,
    itemGems,
    itemTitles,
} from "./item-naming.js";

export type { ItemNamingContext, MutableFlavorTables } from "./item-naming.js";

export {
    removeItemFromArray,
    addItemToArray,
    itemAtLoc,
    itemOfPackLetter,
    numberOfItemsInPack,
    numberOfMatchingPackItems,
    inventoryLetterAvailable,
    nextAvailableInventoryCharacter,
    conflateItemCharacteristics,
    stackItems,
    itemWillStackWithPack,
    addItemToPack,
    itemIsSwappable,
    checkForDisenchantment,
    enchantLevelKnown,
    effectiveEnchantLevel,
    canPickUpItem,
    deleteItem,
} from "./item-inventory.js";

// ── Enchant-swap machine (Phase 7) ──
export { swapItemToEnchantLevel, swapItemEnchants } from "./item-enchant-swap.js";
export type {
    SwapItemToEnchantLevelContext,
    SwapItemEnchantsContext,
} from "./item-enchant-swap.js";

export {
    strengthModifier,
    netEnchant,
    effectiveRingEnchant,
    apparentRingBonus,
    enchantIncrement,
    enchantMagnitude,
    armorValueIfUnenchanted,
    displayedArmorValue,
    estimatedArmorValue,
    recalculateEquipmentBonuses,
    updateRingBonuses,
    updateEncumbrance,
    strengthCheck,
    equipItem,
    unequipItem,
} from "./item-usage.js";

export type { EquipmentState, EquipContext } from "./item-usage.js";

export { enchantItem } from "./item-enchant.js";

export {
    getLineCoordinates,
    getImpactLoc,
    reflectBolt,
    openPathBetween,
    INVALID_POS,
} from "./bolt-geometry.js";

export type {
    BoltPathEvaluator,
    CellBlocksCheck,
    CreatureAtCheck,
} from "./bolt-geometry.js";

export { createItemOps } from "./item-ops.js";

export type { ItemOpsContext } from "./item-ops.js";

// ── Interactive item handlers (Phase 3) ──
export {
    uncurse,
    consumePackItem,
    recordApplyItemCommand,
    autoIdentify,
    detectMagicOnItem,
    magicMapCell,
    updateIdentifiableItems,
    magicCharDiscoverySuffix,
    eat,
    readScroll,
    drinkPotion,
    useStaffOrWand,
    useCharm,
    apply,
} from "./item-handlers.js";

export type { ItemHandlerContext } from "./item-handlers.js";

// ── Floor item processing (Phase 3a/3b) ──
export { updateFloorItems, removeItemAt, placeItemAt, canDrop, dropItem } from "./floor-items.js";
export type {
    UpdateFloorItemsContext,
    RemoveItemAtContext,
    PlaceItemAtContext,
    DropItemContext,
} from "./floor-items.js";

// ── Bolt item mapping (Phase 1a) ──
export { boltForItem, boltEffectForItem } from "./bolt-item-mapping.js";

// ── Bolt helpers (Phase 1c) ──
export {
    tunnelize,
    negationWillAffectMonster,
    projectileReflects,
} from "./bolt-helpers.js";

export type {
    TunnelizeContext,
    ProjectileReflectsContext,
} from "./bolt-helpers.js";

// ── Bolt system (Phase 1d) ──
export { updateBolt } from "./bolt-update.js";
export { detonateBolt } from "./bolt-detonation.js";
export { zap } from "./zap.js";
export type { ZapContext, ZapRenderContext } from "./zap-context.js";

// ── Spell effects (Phase 2a) ──
export { slow, weaken } from "./item-effects.js";
export type { SlowContext, WeakenContext } from "./item-effects.js";

// ── Monster spell effects (Phase 2b) ──
export { polymorph, aggravateMonsters, crystalize, summonGuardian } from "./monster-spell-effects.js";
export type {
    PolymorphContext,
    AggravateContext,
    CrystalizeContext,
    SummonGuardianContext,
} from "./monster-spell-effects.js";

// ── Teleport / disentangle (Phase 2c) ──
export { disentangle, teleport } from "../monsters/monster-teleport.js";
export type { DisentangleContext, TeleportContext } from "../monsters/monster-teleport.js";

// ── Item utilities (Phase 5) ──
export {
    lotteryDraw,
    describeMonsterClass,
    keyMatchesLocation,
    monsterClassHasAcidicMonster,
    beckonMonster,
    itemCanBeCalled,
} from "./item-utils.js";
export type { BeckonMonsterContext } from "./item-utils.js";

// ── Item call / inscription (Phase 1b) ──
export { inscribeItem } from "./item-call.js";
export type { InscribeContext } from "./item-call.js";

// ── Throw system (Phase 6) ──
export { hitMonsterWithProjectileWeapon, throwItem } from "./throw-item.js";

// ── Targeting UI (Phases 1c–1d) ──
export { hiliteTrajectory, playerCancelsBlinking, chooseTarget } from "./targeting.js";
export type {
    HiliteTrajectoryContext,
    PlayerCancelsBlinkingContext,
    ChooseTargetContext,
} from "./targeting.js";
export type {
    HitMonsterContext,
    ThrowItemRenderContext,
    ThrowItemContext,
} from "./throw-item.js";
