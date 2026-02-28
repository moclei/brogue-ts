/*
 *  io-inventory.test.ts — Tests for io-inventory.ts
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    COLS,
    ROWS,
    DCOLS,
    DROWS,
    KEYBOARD_LABELS,
    MAX_PACK_ITEMS,
    INTERFACE_OPACITY,
    ESCAPE_KEY,
    ACKNOWLEDGE_KEY,
    UP_KEY,
    DOWN_KEY,
    APPLY_KEY,
    EQUIP_KEY,
    UP_ARROW,
    DOWN_ARROW,
    NUMPAD_2,
    NUMPAD_8,
} from "../../src/types/constants.js";
import { ButtonDrawState, ItemCategory, DisplayGlyph } from "../../src/types/enums.js";
import { ButtonFlag, ItemFlag } from "../../src/types/flags.js";
import type {
    Color,
    BrogueButton,
    ScreenDisplayBuffer,
    RogueEvent,
    SavedDisplayBuffer,
    Item,
} from "../../src/types/types.js";
import { EventType } from "../../src/types/enums.js";
import { white, gray, black, itemColor, goodMessageColor, badMessageColor, interfaceBoxColor } from "../../src/globals/colors.js";
import { createScreenDisplayBuffer, clearDisplayBuffer } from "../../src/io/io-display.js";
import {
    type InventoryContext,
    displayMagicCharForItem,
    rectangularShading,
    printTextBox,
    displayInventory,
} from "../../src/io/io-inventory.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: ItemCategory.WEAPON,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: "|".charCodeAt(0) as DisplayGlyph,
        foreColor: null,
        inventoryColor: null,
        quantity: 1,
        inventoryLetter: "a",
        inscription: "",
        loc: { x: 0, y: 0 },
        keyLoc: [],
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    };
}

function createCtx(overrides: Partial<InventoryContext> = {}): InventoryContext {
    return {
        rogue: {
            weapon: null,
            armor: null,
            ringLeft: null,
            ringRight: null,
        },
        packItems: [],
        applyColorAverage: vi.fn((base: Color, target: Readonly<Color>, weight: number) => {
            base.red = Math.round(base.red + (target.red - base.red) * weight / 100);
            base.green = Math.round(base.green + (target.green - base.green) * weight / 100);
            base.blue = Math.round(base.blue + (target.blue - base.blue) * weight / 100);
        }),
        encodeMessageColor: vi.fn(() => ""),
        storeColorComponents: vi.fn((c: Readonly<Color>) => [c.red, c.green, c.blue] as [number, number, number]),
        createScreenDisplayBuffer,
        clearDisplayBuffer,
        overlayDisplayBuffer: vi.fn(),
        saveDisplayBuffer: vi.fn(() => ({ savedScreen: createScreenDisplayBuffer() })),
        restoreDisplayBuffer: vi.fn(),
        drawButton: vi.fn(),
        plotCharToBuffer: vi.fn(),
        printStringWithWrapping: vi.fn(() => 1),
        strLenWithoutEscapes: vi.fn((s: string) => {
            // Simple: count non-control chars
            return s.length;
        }),
        wrapText: vi.fn((s: string, width: number) => ({
            text: s,
            lineCount: Math.max(1, Math.ceil(s.length / Math.max(1, width))),
        })),
        buttonInputLoop: vi.fn(() => ({
            chosenButton: -1,
            event: {
                eventType: EventType.Keystroke,
                param1: ESCAPE_KEY,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            },
        })),
        printCarriedItemDetails: vi.fn(() => -1),
        itemName: vi.fn((item: Item) => `a ${item.category === ItemCategory.WEAPON ? "sword" : "item"}`),
        upperCase: vi.fn((s: string) => s.charAt(0).toUpperCase() + s.slice(1)),
        itemMagicPolarity: vi.fn(() => 0),
        numberOfItemsInPack: vi.fn(() => 0),
        clearCursorPath: vi.fn(),
        confirmMessages: vi.fn(),
        message: vi.fn(),
        mapToWindowX: vi.fn((x: number) => x + 1),
        mapToWindowY: vi.fn((y: number) => y + 2),
        white: { ...white },
        gray: { ...gray },
        black: { ...black },
        itemColor: { ...itemColor },
        goodMessageColor: { ...goodMessageColor },
        badMessageColor: { ...badMessageColor },
        interfaceBoxColor: { ...interfaceBoxColor },
        G_GOOD_MAGIC: DisplayGlyph.G_GOOD_MAGIC,
        G_BAD_MAGIC: DisplayGlyph.G_BAD_MAGIC,
        ...overrides,
    };
}

// =============================================================================
// displayMagicCharForItem
// =============================================================================

describe("displayMagicCharForItem", () => {
    it("returns true for magic-detected non-prenamed item", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_MAGIC_DETECTED,
        });
        expect(displayMagicCharForItem(item)).toBe(true);
    });

    it("returns false when not magic-detected", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, flags: 0 });
        expect(displayMagicCharForItem(item)).toBe(false);
    });

    it("returns false for prenamed categories even if magic-detected", () => {
        const item = makeItem({
            category: ItemCategory.FOOD,
            flags: ItemFlag.ITEM_MAGIC_DETECTED,
        });
        expect(displayMagicCharForItem(item)).toBe(false);
    });

    it("returns false for gold", () => {
        const item = makeItem({
            category: ItemCategory.GOLD,
            flags: ItemFlag.ITEM_MAGIC_DETECTED,
        });
        expect(displayMagicCharForItem(item)).toBe(false);
    });

    it("returns true for staff with detection", () => {
        const item = makeItem({
            category: ItemCategory.STAFF,
            flags: ItemFlag.ITEM_MAGIC_DETECTED,
        });
        expect(displayMagicCharForItem(item)).toBe(true);
    });
});

// =============================================================================
// rectangularShading
// =============================================================================

describe("rectangularShading", () => {
    it("sets full opacity inside the rectangle", () => {
        const dbuf = createScreenDisplayBuffer();
        const ctx = createCtx();
        rectangularShading(10, 5, 20, 10, { ...black }, 90, dbuf, ctx);
        expect(dbuf.cells[15][7].opacity).toBe(90);
    });

    it("caps opacity at 100", () => {
        const dbuf = createScreenDisplayBuffer();
        const ctx = createCtx();
        rectangularShading(0, 0, 5, 5, { ...black }, 150, dbuf, ctx);
        expect(dbuf.cells[2][2].opacity).toBe(100);
    });

    it("reduces opacity outside with distance falloff", () => {
        const dbuf = createScreenDisplayBuffer();
        const ctx = createCtx();
        rectangularShading(10, 10, 5, 5, { ...black }, 80, dbuf, ctx);
        // One cell outside should have reduced opacity
        const outerOpacity = dbuf.cells[9][10].opacity;
        expect(outerOpacity).toBeLessThan(80);
        expect(outerOpacity).toBeGreaterThan(0);
    });

    it("sets opacity to 0 for very distant cells", () => {
        const dbuf = createScreenDisplayBuffer();
        const ctx = createCtx();
        rectangularShading(10, 10, 5, 5, { ...black }, 20, dbuf, ctx);
        // Far corner should be 0
        expect(dbuf.cells[0][0].opacity).toBe(0);
    });

    it("stores color components for all cells", () => {
        const dbuf = createScreenDisplayBuffer();
        const ctx = createCtx();
        const color = makeColor(50, 60, 70);
        rectangularShading(0, 0, 1, 1, color, 80, dbuf, ctx);
        expect(ctx.storeColorComponents).toHaveBeenCalled();
    });
});

// =============================================================================
// printTextBox
// =============================================================================

describe("printTextBox", () => {
    it("auto-calculates position when width <= 0 and x < center", () => {
        const ctx = createCtx();
        printTextBox("Hello World", 5, 0, 0, white, black, ctx);
        expect(ctx.printStringWithWrapping).toHaveBeenCalled();
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalled();
    });

    it("auto-calculates position when width <= 0 and x >= center", () => {
        const ctx = createCtx();
        printTextBox("Hello World", DCOLS / 2, 0, 0, white, black, ctx);
        expect(ctx.printStringWithWrapping).toHaveBeenCalled();
    });

    it("uses provided position when width > 0", () => {
        const ctx = createCtx();
        printTextBox("Hello", 10, 5, 30, white, black, ctx);
        // printStringWithWrapping should be called with x=10, y=5
        const call = (ctx.printStringWithWrapping as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(call[1]).toBe(10);
        expect(call[2]).toBe(5);
    });

    it("returns -1 when no buttons provided", () => {
        const ctx = createCtx();
        const result = printTextBox("Hello", 10, 5, 30, white, black, ctx);
        expect(result).toBe(-1);
    });

    it("runs button input loop when buttons provided", () => {
        const ctx = createCtx({
            buttonInputLoop: vi.fn(() => ({
                chosenButton: 1,
                event: { eventType: EventType.Keystroke, param1: 0, param2: 0, controlKey: false, shiftKey: false },
            })),
        });
        const buttons: BrogueButton[] = [{
            text: "OK",
            x: 0,
            y: 0,
            hotkey: [],
            buttonColor: { ...black },
            textColor: { ...white },
            hotkeyTextColor: { ...white },
            opacity: 100,
            symbol: [],
            flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED,
            command: 0 as any,
        }];
        const result = printTextBox("Choose", 10, 5, 30, white, black, ctx, buttons, 1);
        expect(result).toBe(1);
        expect(ctx.buttonInputLoop).toHaveBeenCalled();
    });

    it("applies rectangular shading", () => {
        const ctx = createCtx();
        const dbuf = createScreenDisplayBuffer();
        printTextBox("Test", 10, 5, 20, white, black, ctx);
        // overlayDisplayBuffer should be called with a buffer that has shading
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalled();
    });
});

// =============================================================================
// displayInventory — empty pack
// =============================================================================

describe("displayInventory — empty pack", () => {
    it("returns empty string with empty pack message", () => {
        const ctx = createCtx({ packItems: [] });
        const result = displayInventory(0xFFFF, 0, 0, true, false, ctx);
        expect(result).toBe("");
        expect(ctx.confirmMessages).toHaveBeenCalled();
        expect(ctx.message).toHaveBeenCalledWith("Your pack is empty!", 0);
    });
});

// =============================================================================
// displayInventory — item listing
// =============================================================================

describe("displayInventory — item listing", () => {
    it("lists equipped items first", () => {
        const sword = makeItem({ inventoryLetter: "a", flags: ItemFlag.ITEM_EQUIPPED, category: ItemCategory.WEAPON });
        const potion = makeItem({ inventoryLetter: "b", category: ItemCategory.POTION });
        const ctx = createCtx({
            rogue: { weapon: sword, armor: null, ringLeft: null, ringRight: null },
            packItems: [sword, potion],
        });

        displayInventory(0xFFFF, 0, 0, false, false, ctx);

        // buttonInputLoop should have been called
        expect(ctx.buttonInputLoop).toHaveBeenCalled();
        // drawButton should have been called for each item
        expect(ctx.drawButton).toHaveBeenCalled();
    });

    it("returns item letter when item selected", () => {
        const sword = makeItem({ inventoryLetter: "a", category: ItemCategory.WEAPON });
        const ctx = createCtx({
            packItems: [sword],
            buttonInputLoop: vi.fn(() => ({
                chosenButton: 0,
                event: { eventType: EventType.Keystroke, param1: "a".charCodeAt(0), param2: 0, controlKey: false, shiftKey: false },
            })),
        });

        const result = displayInventory(0xFFFF, 0, 0, false, false, ctx);
        expect(result).toBe("a");
    });

    it("returns empty string when user cancels", () => {
        const sword = makeItem({ inventoryLetter: "a" });
        const ctx = createCtx({
            packItems: [sword],
            buttonInputLoop: vi.fn(() => ({
                chosenButton: -1,
                event: { eventType: EventType.Keystroke, param1: ESCAPE_KEY, param2: 0, controlKey: false, shiftKey: false },
            })),
        });

        const result = displayInventory(0xFFFF, 0, 0, false, false, ctx);
        expect(result).toBe("");
    });

    it("clears cursor path before display", () => {
        const ctx = createCtx({ packItems: [makeItem()] });
        displayInventory(0xFFFF, 0, 0, false, false, ctx);
        expect(ctx.clearCursorPath).toHaveBeenCalled();
    });

    it("includes room remaining text when waitForAcknowledge", () => {
        const sword = makeItem({ inventoryLetter: "a" });
        const ctx = createCtx({
            packItems: [sword],
            numberOfItemsInPack: vi.fn(() => 1),
        });
        displayInventory(0xFFFF, 0, 0, true, false, ctx);
        // drawButton is called for the item + extra lines
        const drawCalls = (ctx.drawButton as ReturnType<typeof vi.fn>).mock.calls;
        expect(drawCalls.length).toBeGreaterThan(1);
    });

    it("shows separator when equipped items exist", () => {
        const sword = makeItem({
            inventoryLetter: "a",
            flags: ItemFlag.ITEM_EQUIPPED,
            category: ItemCategory.WEAPON,
        });
        const potion = makeItem({ inventoryLetter: "b", category: ItemCategory.POTION });
        const ctx = createCtx({
            rogue: { weapon: sword, armor: null, ringLeft: null, ringRight: null },
            packItems: [sword, potion],
        });

        displayInventory(0xFFFF, 0, 0, true, false, ctx);
        // Should have extra buttons drawn (separator + info lines)
        const drawCalls = (ctx.drawButton as ReturnType<typeof vi.fn>).mock.calls;
        expect(drawCalls.length).toBeGreaterThanOrEqual(4); // 2 items + separator + info lines
    });

    it("displays magic detection symbols for detected items", () => {
        const staff = makeItem({
            inventoryLetter: "a",
            category: ItemCategory.STAFF,
            flags: ItemFlag.ITEM_MAGIC_DETECTED,
        });
        const ctx = createCtx({
            packItems: [staff],
            itemMagicPolarity: vi.fn(() => 1),
        });

        displayInventory(0xFFFF, 0, 0, false, false, ctx);
        expect(ctx.itemMagicPolarity).toHaveBeenCalled();
    });
});

// =============================================================================
// displayInventory — detail view
// =============================================================================

describe("displayInventory — detail view", () => {
    it("shows item details on shift-click", () => {
        const sword = makeItem({ inventoryLetter: "a" });
        let callCount = 0;
        const ctx = createCtx({
            packItems: [sword],
            buttonInputLoop: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        chosenButton: 0,
                        event: {
                            eventType: EventType.Keystroke,
                            param1: "a".charCodeAt(0),
                            param2: 0,
                            controlKey: false,
                            shiftKey: true,
                        },
                    };
                }
                // Second call — cancel
                return {
                    chosenButton: -1,
                    event: {
                        eventType: EventType.Keystroke,
                        param1: ESCAPE_KEY,
                        param2: 0,
                        controlKey: false,
                        shiftKey: false,
                    },
                };
            }),
            printCarriedItemDetails: vi.fn(() => -1),
        });

        displayInventory(0xFFFF, 0, 0, false, false, ctx);
        expect(ctx.printCarriedItemDetails).toHaveBeenCalled();
    });

    it("shows item details on waitForAcknowledge", () => {
        const sword = makeItem({ inventoryLetter: "a" });
        let callCount = 0;
        const ctx = createCtx({
            packItems: [sword],
            buttonInputLoop: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        chosenButton: 0,
                        event: {
                            eventType: EventType.Keystroke,
                            param1: "a".charCodeAt(0),
                            param2: 0,
                            controlKey: false,
                            shiftKey: false,
                        },
                    };
                }
                return {
                    chosenButton: -1,
                    event: {
                        eventType: EventType.Keystroke,
                        param1: ESCAPE_KEY,
                        param2: 0,
                        controlKey: false,
                        shiftKey: false,
                    },
                };
            }),
            printCarriedItemDetails: vi.fn(() => -1),
        });

        displayInventory(0xFFFF, 0, 0, true, false, ctx);
        expect(ctx.printCarriedItemDetails).toHaveBeenCalled();
    });

    it("returns empty string when action taken from detail view", () => {
        const sword = makeItem({ inventoryLetter: "a" });
        const ctx = createCtx({
            packItems: [sword],
            buttonInputLoop: vi.fn(() => ({
                chosenButton: 0,
                event: {
                    eventType: EventType.Keystroke,
                    param1: "a".charCodeAt(0),
                    param2: 0,
                    controlKey: false,
                    shiftKey: true,
                },
            })),
            printCarriedItemDetails: vi.fn(() => EQUIP_KEY),
        });

        const result = displayInventory(0xFFFF, 0, 0, false, false, ctx);
        expect(result).toBe("");
    });
});

// =============================================================================
// displayInventory — up/down navigation
// =============================================================================

describe("displayInventory — up/down navigation", () => {
    it("handles up arrow button via hidden button", () => {
        const item1 = makeItem({ inventoryLetter: "a" });
        const item2 = makeItem({ inventoryLetter: "b" });
        let callCount = 0;
        const ctx = createCtx({
            packItems: [item1, item2],
            buttonInputLoop: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    // Up arrow button is at itemNumber + extraLineCount + 0
                    // With 2 items and no wait, extraLineCount = 0, so up = index 2
                    return {
                        chosenButton: 2, // up arrow hidden button
                        event: {
                            eventType: EventType.Keystroke,
                            param1: UP_ARROW,
                            param2: 0,
                            controlKey: false,
                            shiftKey: false,
                        },
                    };
                }
                return {
                    chosenButton: -1,
                    event: {
                        eventType: EventType.Keystroke,
                        param1: ESCAPE_KEY,
                        param2: 0,
                        controlKey: false,
                        shiftKey: false,
                    },
                };
            }),
        });

        // The up arrow maps to last item; but with shiftKey=true, it opens details
        // Since printCarriedItemDetails returns -1 (cancel), it loops back
        const result = displayInventory(0xFFFF, 0, 0, false, false, ctx);
        // After the up arrow sets shiftKey, item details shown, then cancel on repeat
        expect(ctx.printCarriedItemDetails).toHaveBeenCalled();
    });
});

// =============================================================================
// displayInventory — filter
// =============================================================================

describe("displayInventory — filter", () => {
    it("enables hover only for matching items", () => {
        const weapon = makeItem({ inventoryLetter: "a", category: ItemCategory.WEAPON });
        const potion = makeItem({ inventoryLetter: "b", category: ItemCategory.POTION });
        const ctx = createCtx({
            packItems: [weapon, potion],
        });

        displayInventory(ItemCategory.WEAPON, 0, 0, false, false, ctx);
        // drawButton is called for both items
        const drawCalls = (ctx.drawButton as ReturnType<typeof vi.fn>).mock.calls;
        expect(drawCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("respects requiredFlags filter", () => {
        const equipped = makeItem({
            inventoryLetter: "a",
            flags: ItemFlag.ITEM_EQUIPPED,
            category: ItemCategory.WEAPON,
        });
        const ctx = createCtx({
            rogue: { weapon: equipped, armor: null, ringLeft: null, ringRight: null },
            packItems: [equipped],
        });

        displayInventory(0xFFFF, ItemFlag.ITEM_EQUIPPED, 0, false, false, ctx);
        expect(ctx.drawButton).toHaveBeenCalled();
    });
});
