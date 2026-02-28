/*
 *  wizard.test.ts — Tests for wizard.ts (debug mode dialogs)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { COLS, KEYBOARD_LABELS, INTERFACE_OPACITY, MAX_PACK_ITEMS, MONSTER_CLASS_COUNT, NUMBER_MUTATORS, NUMBER_WEAPON_RUNIC_KINDS, NUMBER_GOOD_WEAPON_ENCHANT_KINDS } from "../../src/types/constants.js";
import { ItemCategory, CAN_BE_ENCHANTED, NEVER_IDENTIFIABLE, WeaponKind, WeaponEnchant, ArmorKind, ArmorEnchant, MonsterType, TextEntryType, DisplayGlyph, CreatureState } from "../../src/types/enums.js";
import { ButtonFlag, ItemFlag, MessageFlag, MonsterBehaviorFlag } from "../../src/types/flags.js";
import { MONST_NEVER_MUTATED, MA_NEVER_MUTATED } from "../../src/types/flags.js";
import type { Color, BrogueButton, ScreenDisplayBuffer, SavedDisplayBuffer, Item, Creature, CreatureType, ItemTable, MonsterClass, Mutation, Pos, WindowPos, RogueEvent } from "../../src/types/types.js";
import {
    type WizardContext,
    DIALOG_CREATE_ITEM_MAX_BUTTONS,
    unflag,
    initializeCreateItemButton,
    dialogSelectEntryFromList,
    dialogCreateItemChooseVorpalEnemy,
    dialogCreateItemChooseRunic,
    dialogCreateItemChooseKind,
    dialogCreateItemChooseEnchantmentLevel,
    dialogCreateMonsterChooseMutation,
    dialogCreateMonster,
    dialogCreateItem,
    dialogCreateItemOrMonster,
} from "../../src/menus/wizard.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: 0,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: 0 as DisplayGlyph,
        foreColor: null,
        inventoryColor: null,
        quantity: 0,
        inventoryLetter: "a",
        inscription: "",
        loc: { x: 0, y: 0 },
        keyLoc: [],
        originDepth: 0,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    };
}

function makeCreatureType(overrides: Partial<CreatureType> = {}): CreatureType {
    return {
        monsterID: MonsterType.MK_RAT,
        monsterName: "rat",
        displayChar: DisplayGlyph.G_RAT,
        foreColor: makeColor(100, 100, 100),
        maxHP: 6,
        defense: 0,
        accuracy: 80,
        damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
        turnsBetweenRegen: 20,
        movementSpeed: 100,
        attackSpeed: 100,
        bloodType: 0,
        intrinsicLightType: 0,
        DFChance: 0,
        DFType: 0,
        bolts: [],
        flags: 0,
        abilityFlags: 0,
        ...overrides,
    } as CreatureType;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        info: makeCreatureType(),
        loc: { x: 5, y: 5 },
        depth: 1,
        currentHP: 6,
        turnsUntilRegen: 0,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: CreatureState.Wandering,
        creatureMode: 0 as any,
        ...overrides,
    } as Creature;
}

let buttonIdCounter = 0;

function makeButton(): BrogueButton {
    return {
        text: "",
        x: 0,
        y: 0,
        hotkey: [],
        buttonColor: makeColor(),
        opacity: 100,
        flags: 0,
        symbol: [0],
    } as BrogueButton;
}

function makeWizardContext(overrides: Partial<WizardContext> = {}): WizardContext {
    const dbuf = {} as ScreenDisplayBuffer;
    const rbuf = {} as SavedDisplayBuffer;

    return {
        rogue: {
            depthLevel: 5,
            gold: 100,
            featRecord: new Array(30).fill(false),
        },

        createScreenDisplayBuffer: vi.fn(() => dbuf),
        clearDisplayBuffer: vi.fn(),
        overlayDisplayBuffer: vi.fn(),
        saveDisplayBuffer: vi.fn(() => rbuf),
        restoreDisplayBuffer: vi.fn(),
        printString: vi.fn(),
        rectangularShading: vi.fn(),

        initializeButton: vi.fn(() => makeButton()),
        buttonInputLoop: vi.fn(() => ({ chosenButton: 0, event: { eventType: 0 } as RogueEvent })),

        strLenWithoutEscapes: vi.fn((s: string) => s.length),
        getInputTextString: vi.fn(() => null),
        confirm: vi.fn(() => false),
        confirmMessages: vi.fn(),
        temporaryMessage: vi.fn(),
        message: vi.fn(),
        messageWithColor: vi.fn(),

        chooseTarget: vi.fn(() => false),
        playerCanSeeOrSense: vi.fn(() => true),

        monsterCatalog: [
            makeCreatureType({ monsterID: MonsterType.MK_RAT, monsterName: "rat" }),
            makeCreatureType({ monsterID: MonsterType.MK_KOBOLD, monsterName: "kobold" }),
            makeCreatureType({ monsterID: MonsterType.MK_LICH, monsterName: "lich" }),
            makeCreatureType({ monsterID: MonsterType.MK_PHOENIX, monsterName: "phoenix" }),
        ],
        monsterClassCatalog: Array.from({ length: MONSTER_CLASS_COUNT }, (_, i) => ({
            name: `class-${i}`,
            frequency: 10,
            maxDepth: -1,
            memberList: [],
        })),
        mutationCatalog: Array.from({ length: NUMBER_MUTATORS }, (_, i) => ({
            title: `mutation-${i}`,
            textColor: makeColor(),
            healthFactor: 100,
            moveSpeedFactor: 100,
            attackSpeedFactor: 100,
            defenseFactor: 100,
            damageFactor: 100,
            DFChance: 0,
            DFType: 0,
            light: 0,
            forbiddenFlags: 0,
            forbiddenAbilityFlags: 0,
            description: "",
        })),
        itemCategoryNames: [
            "food", "weapon", "armor", "potion", "scroll",
            "staff", "wand", "ring", "charm", "gold",
            "amulet", "gem", "key",
        ],
        weaponRunicNames: [
            "speed", "quietus", "paralysis", "multiplicity", "slowing",
            "confusion", "force", "slaying", "mercy", "plenty",
        ],
        armorRunicNames: [
            "multiplicity", "mutuality", "absorption", "reprisal",
            "immunity", "reflection", "respiration", "dampening",
            "burden", "vulnerability", "immolation",
        ],

        tableForItemCategory: vi.fn((cat: number) => {
            if (cat === ItemCategory.WEAPON) {
                return [
                    { name: "dagger", flavor: "", callTitle: "", frequency: 10, strengthRequired: 10, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 0, marketValue: 0, description: "" },
                    { name: "sword", flavor: "", callTitle: "", frequency: 10, strengthRequired: 12, range: { lowerBound: 2, upperBound: 5, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 0, marketValue: 0, description: "" },
                ] as any;
            }
            return null;
        }),
        itemKindCount: vi.fn((cat: number, _pol: number) => {
            if (cat === ItemCategory.WEAPON) return 2;
            return 0;
        }),

        numberOfItemsInPack: vi.fn(() => 5),
        generateItem: vi.fn((_cat: number, _kind: number) => makeItem({ category: _cat, kind: _kind, enchant1: 1, flags: ItemFlag.ITEM_CAN_BE_IDENTIFIED })),
        addItemToPack: vi.fn((item: Item) => item),
        itemName: vi.fn(() => "a +1 dagger"),
        identify: vi.fn(),
        deleteItem: vi.fn(),

        generateMonster: vi.fn((_id: MonsterType) => makeCreature({
            info: makeCreatureType({ monsterID: _id, monsterName: "test monster" }),
        })),
        initializeMonster: vi.fn(),
        mutateMonster: vi.fn(),
        monsterAtLoc: vi.fn(() => null),
        killCreature: vi.fn(),
        removeDeadMonsters: vi.fn(),
        becomeAllyWith: vi.fn(),
        fadeInMonster: vi.fn(),

        refreshSideBar: vi.fn(),
        refreshDungeonCell: vi.fn(),
        pmapLayerAt: vi.fn(() => 0),
        cellHasTerrainFlag: vi.fn(() => false),
        pmapFlagsAt: vi.fn(() => 0),

        HAS_MONSTER: 1,
        T_OBSTRUCTS_PASSABILITY: 1,
        DUNGEON_LAYER: 0,
        WALL_TILE: 1,
        AUTOTARGET_MODE_NONE: 0,
        FEAT_TONE: 0,

        rand_range: vi.fn((lo: number, hi: number) => lo),

        black: makeColor(0, 0, 0),
        white: makeColor(100, 100, 100),
        itemMessageColor: makeColor(50, 50, 50),
        interfaceBoxColor: makeColor(20, 20, 20),

        WINDOW_POSITION_DUNGEON_TOP_LEFT: { windowX: 8, windowY: 4 },

        ...overrides,
    };
}

// =============================================================================
// Tests
// =============================================================================

describe("unflag", () => {
    it("returns bit index for single-bit flags", () => {
        expect(unflag(1)).toBe(0);
        expect(unflag(2)).toBe(1);
        expect(unflag(4)).toBe(2);
        expect(unflag(8)).toBe(3);
        expect(unflag(256)).toBe(8);
    });

    it("returns -1 for zero", () => {
        expect(unflag(0)).toBe(-1);
    });

    it("finds first set bit for multi-bit values (matches C behavior)", () => {
        // 3 = 0b11 → (3 >> 1) === 1, so returns 1
        expect(unflag(3)).toBe(1);
    });
});

describe("initializeCreateItemButton", () => {
    it("capitalizes the first letter of the button text", () => {
        const ctx = makeWizardContext();
        const button = initializeCreateItemButton("test button", ctx);
        // upperCase only capitalizes the first non-escape character
        expect(button.text).toBe("Test button");
    });

    it("calls initializeButton from context", () => {
        const ctx = makeWizardContext();
        initializeCreateItemButton("foo", ctx);
        expect(ctx.initializeButton).toHaveBeenCalled();
    });
});

describe("dialogSelectEntryFromList", () => {
    it("configures buttons with hotkeys and positions", () => {
        const ctx = makeWizardContext();
        const buttons = [makeButton(), makeButton()];
        buttons[0].text = "Alpha";
        buttons[1].text = "Beta";

        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 1, event: {} });

        const result = dialogSelectEntryFromList(buttons, 2, "Pick one:", ctx);

        expect(result).toBe(1);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalled();
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalled();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
    });

    it("returns -1 when user cancels", () => {
        const ctx = makeWizardContext();
        const buttons = [makeButton()];
        buttons[0].text = "Foo";
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: -1, event: {} });

        expect(dialogSelectEntryFromList(buttons, 1, "Title:", ctx)).toBe(-1);
    });

    it("adds keyboard labels when KEYBOARD_LABELS is true", () => {
        const ctx = makeWizardContext();
        const buttons = [makeButton(), makeButton()];
        buttons[0].text = "Alpha";
        buttons[1].text = "Beta";

        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogSelectEntryFromList(buttons, 2, "Title:", ctx);

        // KEYBOARD_LABELS is true by default in the constants
        if (KEYBOARD_LABELS) {
            expect(buttons[0].text).toMatch(/^a\)/);
            expect(buttons[1].text).toMatch(/^b\)/);
        }
    });

    it("positions buttons relative to dungeon top-left", () => {
        const ctx = makeWizardContext();
        const buttons = [makeButton(), makeButton()];
        buttons[0].text = "One";
        buttons[1].text = "Two";

        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogSelectEntryFromList(buttons, 2, "Title:", ctx);

        expect(buttons[0].x).toBe(ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowX);
        expect(buttons[0].y).toBe(ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowY + 1);
        expect(buttons[1].y).toBe(ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowY + 2);
    });
});

describe("dialogCreateItemChooseVorpalEnemy", () => {
    it("shows one button per monster class", () => {
        const ctx = makeWizardContext();
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 3, event: {} });

        const result = dialogCreateItemChooseVorpalEnemy(ctx);
        expect(result).toBe(3);
        // initializeButton called MONSTER_CLASS_COUNT times
        expect(ctx.initializeButton).toHaveBeenCalledTimes(MONSTER_CLASS_COUNT);
    });
});

describe("dialogCreateItemChooseRunic", () => {
    it("does nothing for non-weapon/non-armor items", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.POTION });

        dialogCreateItemChooseRunic(item, ctx);
        expect(ctx.initializeButton).not.toHaveBeenCalled();
    });

    it("does nothing for thrown weapons (quiverNumber > 0)", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.WEAPON, kind: WeaponKind.Dart, quiverNumber: 1 });

        dialogCreateItemChooseRunic(item, ctx);
        expect(ctx.initializeButton).not.toHaveBeenCalled();
    });

    it("assigns selected weapon runic to item", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.WEAPON, kind: WeaponKind.Sword, quiverNumber: 0 });

        // Select runic index 2 (paralysis)
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 2, event: {} });

        dialogCreateItemChooseRunic(item, ctx);

        expect(item.enchant2).toBe(2);
        expect(item.flags & ItemFlag.ITEM_RUNIC).toBeTruthy();
    });

    it("offers only bad runics for heavy weapons", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.WEAPON, kind: WeaponKind.Hammer, quiverNumber: 0 });

        // Select first bad runic
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogCreateItemChooseRunic(item, ctx);

        // enchant2 should be offset by NUMBER_GOOD_WEAPON_ENCHANT_KINDS
        expect(item.enchant2).toBe(NUMBER_GOOD_WEAPON_ENCHANT_KINDS);
    });

    it("removes runic when No Runic chosen", () => {
        const ctx = makeWizardContext();
        const item = makeItem({
            category: ItemCategory.WEAPON,
            kind: WeaponKind.Sword,
            quiverNumber: 0,
            flags: ItemFlag.ITEM_RUNIC,
            enchant2: 5,
        });

        // Total buttons = NUMBER_WEAPON_RUNIC_KINDS + 1 (No Runic)
        // No Runic is last, at index NUMBER_WEAPON_RUNIC_KINDS
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({
            chosenButton: NUMBER_WEAPON_RUNIC_KINDS,
            event: {},
        });

        dialogCreateItemChooseRunic(item, ctx);

        expect(item.enchant2).toBe(0);
        expect(item.flags & ItemFlag.ITEM_RUNIC).toBeFalsy();
    });

    it("prompts for vorpal enemy when slaying runic chosen", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.WEAPON, kind: WeaponKind.Sword, quiverNumber: 0 });

        // First call: select Slaying (index 7)
        // Second call (vorpal enemy): select index 2
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { chosenButton: WeaponEnchant.Slaying, event: {} };
            return { chosenButton: 2, event: {} };
        });

        dialogCreateItemChooseRunic(item, ctx);

        expect(item.enchant2).toBe(WeaponEnchant.Slaying);
        expect(item.vorpalEnemy).toBe(2);
    });

    it("handles armor runics", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.ARMOR, kind: ArmorKind.Leather });

        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogCreateItemChooseRunic(item, ctx);

        expect(item.enchant2).toBe(0); // Multiplicity
        expect(item.flags & ItemFlag.ITEM_RUNIC).toBeTruthy();
    });

    it("offers only bad runics for plate mail", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.ARMOR, kind: ArmorKind.PlateMail });

        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogCreateItemChooseRunic(item, ctx);

        // enchant2 should be offset by NumberGoodArmorEnchantKinds
        expect(item.enchant2).toBe(ArmorEnchant.NumberGoodArmorEnchantKinds);
    });
});

describe("dialogCreateItemChooseKind", () => {
    it("returns selected kind for a weapon", () => {
        const ctx = makeWizardContext();
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 1, event: {} });

        const result = dialogCreateItemChooseKind(ItemCategory.WEAPON, ctx);
        expect(result).toBe(1);
    });

    it("returns -1 when no table exists", () => {
        const ctx = makeWizardContext();
        (ctx.tableForItemCategory as ReturnType<typeof vi.fn>).mockReturnValue(null);
        (ctx.itemKindCount as ReturnType<typeof vi.fn>).mockReturnValue(0);

        const result = dialogCreateItemChooseKind(ItemCategory.GOLD, ctx);
        expect(result).toBe(-1);
    });
});

describe("dialogCreateItemChooseEnchantmentLevel", () => {
    it("sets enchantment from user input", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.RING, enchant1: 0 });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue("3");

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        expect(item.enchant1).toBe(3);
    });

    it("uses default when input is empty", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.RING, enchant1: 2 });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue(null);

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        // enchant1 should remain unchanged
        expect(item.enchant1).toBe(2);
    });

    it("clamps to max value", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.RING, enchant1: 0 });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue("99");

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        expect(item.enchant1).toBe(50); // clamped to max
    });

    it("sets wand charges instead of enchant1", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.WAND, charges: 3 });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue("7");

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        expect(item.charges).toBe(7);
    });

    it("sets staff charges and enchant1", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.STAFF, charges: 3, enchant1: 3 });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue("5");

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        expect(item.charges).toBe(5);
        expect(item.enchant1).toBe(5);
    });

    it("adds ITEM_CURSED flag for negative enchantment", () => {
        const ctx = makeWizardContext();
        const item = makeItem({ category: ItemCategory.RING, enchant1: 0, flags: 0 });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue("-2");

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        expect(item.enchant1).toBe(-2);
        expect(item.flags & ItemFlag.ITEM_CURSED).toBeTruthy();
    });

    it("constrains bad weapon runics to negative enchantment", () => {
        const ctx = makeWizardContext();
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_RUNIC,
            enchant2: NUMBER_GOOD_WEAPON_ENCHANT_KINDS, // bad runic
            enchant1: 0,
        });

        (ctx.getInputTextString as ReturnType<typeof vi.fn>).mockReturnValue("-2");

        dialogCreateItemChooseEnchantmentLevel(item, ctx);

        expect(item.enchant1).toBe(-2);
    });
});

describe("dialogCreateMonsterChooseMutation", () => {
    it("calls mutateMonster with valid mutation index", () => {
        const ctx = makeWizardContext();
        const monster = makeCreature();

        // Select first mutation
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogCreateMonsterChooseMutation(monster, ctx);

        expect(ctx.mutateMonster).toHaveBeenCalledWith(monster, 0);
    });

    it("skips mutations when No mutation chosen", () => {
        const ctx = makeWizardContext();
        const monster = makeCreature();

        // "No mutation" is the last button (index = NUMBER_MUTATORS for a creature with no forbidden flags)
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({
            chosenButton: NUMBER_MUTATORS,
            event: {},
        });

        dialogCreateMonsterChooseMutation(monster, ctx);

        expect(ctx.mutateMonster).not.toHaveBeenCalled();
    });

    it("filters mutations by forbidden flags", () => {
        // Build a full catalog with NUMBER_MUTATORS entries, but one forbidden
        const baseMutation = {
            textColor: makeColor(),
            healthFactor: 100,
            moveSpeedFactor: 100,
            attackSpeedFactor: 100,
            defenseFactor: 100,
            damageFactor: 100,
            DFChance: 0,
            DFType: 0,
            light: 0,
            description: "",
        };
        const catalog = Array.from({ length: NUMBER_MUTATORS }, (_, i) => ({
            ...baseMutation,
            title: `mutation-${i}`,
            forbiddenFlags: i === 0 ? 1 : 0, // mutation-0 is forbidden for flag=1
            forbiddenAbilityFlags: 0,
        }));

        const ctx = makeWizardContext({ mutationCatalog: catalog as any });
        const monster = makeCreature();
        monster.info.flags = 1; // forbids mutation-0

        // Select first valid mutation (which is mutation-1)
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: 0, event: {} });

        dialogCreateMonsterChooseMutation(monster, ctx);

        // mutation-0 was filtered out, so button 0 maps to mutation index 1
        expect(ctx.mutateMonster).toHaveBeenCalledWith(monster, 1);
    });
});

describe("dialogCreateMonster", () => {
    it("returns early when first dialog canceled", () => {
        const ctx = makeWizardContext();
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: -1, event: {} });

        dialogCreateMonster(ctx);

        expect(ctx.generateMonster).not.toHaveBeenCalled();
    });

    it("returns early when second dialog canceled", () => {
        const ctx = makeWizardContext();
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { chosenButton: 0, event: {} }; // range selection
            return { chosenButton: -1, event: {} }; // cancel monster selection
        });

        dialogCreateMonster(ctx);

        expect(ctx.generateMonster).not.toHaveBeenCalled();
    });

    it("generates and places monster when location chosen", () => {
        const ctx = makeWizardContext();
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            return { chosenButton: 0, event: {} };
        });

        // chooseTarget returns true
        (ctx.chooseTarget as ReturnType<typeof vi.fn>).mockImplementation((targetLoc: { value: Pos }) => {
            targetLoc.value = { x: 10, y: 10 };
            return true;
        });

        // Make monster inanimate so we skip the ally prompt
        (ctx.generateMonster as ReturnType<typeof vi.fn>).mockReturnValue(
            makeCreature({
                info: makeCreatureType({
                    monsterID: MonsterType.MK_RAT,
                    monsterName: "test",
                    flags: MonsterBehaviorFlag.MONST_INANIMATE,
                }),
            }),
        );

        dialogCreateMonster(ctx);

        expect(ctx.generateMonster).toHaveBeenCalled();
        expect(ctx.initializeMonster).toHaveBeenCalled();
        expect(ctx.fadeInMonster).toHaveBeenCalled();
        expect(ctx.message).toHaveBeenCalled();
    });

    it("kills creature when no location chosen", () => {
        const ctx = makeWizardContext();
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            return { chosenButton: 0, event: {} };
        });

        (ctx.chooseTarget as ReturnType<typeof vi.fn>).mockReturnValue(false);

        dialogCreateMonster(ctx);

        expect(ctx.killCreature).toHaveBeenCalled();
        expect(ctx.removeDeadMonsters).toHaveBeenCalled();
    });

    it("prompts for ally when creature is animate and vulnerable", () => {
        const ctx = makeWizardContext();
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            return { chosenButton: 0, event: {} };
        });

        (ctx.chooseTarget as ReturnType<typeof vi.fn>).mockImplementation((targetLoc: { value: Pos }) => {
            targetLoc.value = { x: 10, y: 10 };
            return true;
        });

        // Monster with no INANIMATE or INVULNERABLE flags
        (ctx.generateMonster as ReturnType<typeof vi.fn>).mockReturnValue(
            makeCreature({ info: makeCreatureType({ flags: 0, monsterName: "goblin" }) }),
        );

        (ctx.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);

        dialogCreateMonster(ctx);

        expect(ctx.confirm).toHaveBeenCalledWith(expect.stringContaining("ally"), false);
        expect(ctx.becomeAllyWith).toHaveBeenCalled();
    });

    it("shows error for invalid location", () => {
        const ctx = makeWizardContext();
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            return { chosenButton: 0, event: {} };
        });

        (ctx.chooseTarget as ReturnType<typeof vi.fn>).mockImplementation((targetLoc: { value: Pos }) => {
            targetLoc.value = { x: 10, y: 10 };
            return true;
        });

        // Location not visible
        (ctx.playerCanSeeOrSense as ReturnType<typeof vi.fn>).mockReturnValue(false);

        dialogCreateMonster(ctx);

        expect(ctx.temporaryMessage).toHaveBeenCalledWith(expect.stringContaining("Invalid location"), expect.anything());
        expect(ctx.killCreature).toHaveBeenCalled();
    });
});

describe("dialogCreateItem", () => {
    it("refuses when pack is full", () => {
        const ctx = makeWizardContext();
        (ctx.numberOfItemsInPack as ReturnType<typeof vi.fn>).mockReturnValue(MAX_PACK_ITEMS);

        dialogCreateItem(ctx);

        expect(ctx.messageWithColor).toHaveBeenCalledWith(
            expect.stringContaining("pack is already full"),
            expect.anything(),
            0,
        );
    });

    it("returns early when category selection canceled", () => {
        const ctx = makeWizardContext();
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: -1, event: {} });

        dialogCreateItem(ctx);

        expect(ctx.generateItem).not.toHaveBeenCalled();
    });

    it("adds gold directly without generating an item in the pack", () => {
        const ctx = makeWizardContext();
        const goldCategoryIndex = 9; // "gold" is index 9

        // First dialog: select gold
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({
            chosenButton: goldCategoryIndex,
            event: {},
        });

        // generateItem for gold
        (ctx.generateItem as ReturnType<typeof vi.fn>).mockReturnValue(
            makeItem({ category: ItemCategory.GOLD, quantity: 100 }),
        );

        const initialGold = ctx.rogue.gold;
        dialogCreateItem(ctx);

        expect(ctx.rogue.gold).toBe(initialGold + 100);
        expect(ctx.deleteItem).toHaveBeenCalled();
        expect(ctx.addItemToPack).not.toHaveBeenCalled();
    });

    it("creates a weapon and adds it to pack", () => {
        const ctx = makeWizardContext();
        const weaponCategoryIndex = 1; // "weapon" is index 1

        let dialogCallCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            dialogCallCount++;
            return { chosenButton: dialogCallCount === 1 ? weaponCategoryIndex : 0, event: {} };
        });

        // Don't confirm identify
        (ctx.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

        dialogCreateItem(ctx);

        expect(ctx.generateItem).toHaveBeenCalled();
        expect(ctx.addItemToPack).toHaveBeenCalled();
        expect(ctx.messageWithColor).toHaveBeenCalledWith(
            expect.stringContaining("you now have"),
            expect.anything(),
            0,
        );
    });

    it("identifies item when user confirms", () => {
        const ctx = makeWizardContext();
        const scrollCategoryIndex = 4; // "scroll" is index 4

        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({
            chosenButton: scrollCategoryIndex,
            event: {},
        });

        // No table for scroll in our mock, selectedKind = 0
        (ctx.tableForItemCategory as ReturnType<typeof vi.fn>).mockReturnValue(null);

        (ctx.generateItem as ReturnType<typeof vi.fn>).mockReturnValue(
            makeItem({
                category: ItemCategory.SCROLL,
                flags: ItemFlag.ITEM_CAN_BE_IDENTIFIED,
                inventoryLetter: "b",
            }),
        );

        (ctx.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);

        dialogCreateItem(ctx);

        expect(ctx.identify).toHaveBeenCalled();
    });
});

describe("dialogCreateItemOrMonster", () => {
    it("dispatches to dialogCreateItem when Item selected", () => {
        const ctx = makeWizardContext();

        // First call: select "Item" (index 0), subsequent calls: cancel
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { chosenButton: 0, event: {} }; // "Item"
            return { chosenButton: -1, event: {} }; // cancel subsequent dialogs
        });

        dialogCreateItemOrMonster(ctx);

        // Should have entered item creation path (checking for pack full etc.)
        // Since the category dialog is canceled (callCount=2 → -1), generateItem won't be called
        // but the flow enters dialogCreateItem
        expect(ctx.numberOfItemsInPack).toHaveBeenCalled();
    });

    it("dispatches to dialogCreateMonster when Monster selected", () => {
        const ctx = makeWizardContext();

        // First call: select "Monster" (index 1), subsequent calls: cancel
        let callCount = 0;
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { chosenButton: 1, event: {} }; // "Monster"
            return { chosenButton: -1, event: {} }; // cancel subsequent dialogs
        });

        dialogCreateItemOrMonster(ctx);

        // dialogCreateMonster should have been entered (range selection canceled → returns early)
        // We can verify by checking that generateMonster was NOT called (early return)
        expect(ctx.generateMonster).not.toHaveBeenCalled();
    });

    it("does nothing when dialog canceled", () => {
        const ctx = makeWizardContext();
        (ctx.buttonInputLoop as ReturnType<typeof vi.fn>).mockReturnValue({ chosenButton: -1, event: {} });

        dialogCreateItemOrMonster(ctx);

        expect(ctx.numberOfItemsInPack).not.toHaveBeenCalled();
        expect(ctx.generateMonster).not.toHaveBeenCalled();
    });
});

describe("DIALOG_CREATE_ITEM_MAX_BUTTONS", () => {
    it("is 26", () => {
        expect(DIALOG_CREATE_ITEM_MAX_BUTTONS).toBe(26);
    });
});
