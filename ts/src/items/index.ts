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
