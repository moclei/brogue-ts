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

export type { ItemNamingContext } from "./item-naming.js";

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
    canPickUpItem,
} from "./item-inventory.js";
