/*
 *  item-call.test.ts — Tests for inscribeItem
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import { inscribeItem, type InscribeContext } from "../../src/items/item-call.js";
import type { Item, Color } from "../../src/types/types.js";
import { DisplayGlyph, ItemCategory } from "../../src/types/enums.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { itemColor, white } from "../../src/globals/colors.js";

// =============================================================================
// Helpers
// =============================================================================

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = Array.from({ length: KEY_ID_MAXIMUM }, () => ({
        loc: { x: 0, y: 0 }, machine: 0, disposableHere: false,
    }));
    return {
        category: ItemCategory.WEAPON, kind: 0, flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0, charges: 0, enchant1: 0, enchant2: 0,
        timesEnchanted: 0, vorpalEnemy: 0, strengthRequired: 0, quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON, foreColor: itemColor, inventoryColor: white,
        quantity: 1, inventoryLetter: "a", inscription: "",
        loc: { x: 0, y: 0 }, keyLoc, originDepth: 1, spawnTurnNumber: 0, lastUsed: [0, 0, 0],
        nextItem: null,
        ...overrides,
    } as unknown as Item;
}

const DUMMY_COLOR: Color = { red: 100, green: 80, blue: 0, rand: 0, colorDances: false };

function makeCtx(
    inputResult: string | null,
    overrides: Partial<InscribeContext> = {},
): InscribeContext {
    return {
        itemName: (item, _includeDetails, _includeArticle) =>
            `${item.inscription ? `"${item.inscription}" ` : ""}sword`,
        getInputTextString: () => inputResult,
        confirmMessages: vi.fn(),
        messageWithColor: vi.fn(),
        strLenWithoutEscapes: (s) => s.length,
        itemMessageColor: DUMMY_COLOR,
        ...overrides,
    };
}

// =============================================================================
// inscribeItem
// =============================================================================

describe("inscribeItem", () => {
    it("sets inscription and returns true when player confirms", () => {
        const item = makeItem({ inscription: "" });
        const ctx = makeCtx("holy");
        const result = inscribeItem(item, ctx);
        expect(result).toBe(true);
        expect(item.inscription).toBe("holy");
    });

    it("calls confirmMessages and messageWithColor on success", () => {
        const item = makeItem({ inscription: "" });
        const ctx = makeCtx("sharp");
        inscribeItem(item, ctx);
        expect(ctx.confirmMessages).toHaveBeenCalled();
        expect(ctx.messageWithColor).toHaveBeenCalled();
    });

    it("returns false and leaves inscription unchanged when player cancels", () => {
        const item = makeItem({ inscription: "old" });
        const ctx = makeCtx(null);
        const result = inscribeItem(item, ctx);
        expect(result).toBe(false);
        expect(item.inscription).toBe("old");
    });

    it("calls confirmMessages on cancel", () => {
        const item = makeItem({ inscription: "" });
        const ctx = makeCtx(null);
        inscribeItem(item, ctx);
        expect(ctx.confirmMessages).toHaveBeenCalled();
    });

    it("clears inscription before building the prompt name (so old label doesn't appear)", () => {
        const item = makeItem({ inscription: "previous" });
        let firstSeenInscription: string | null = null;
        const ctx = makeCtx("new", {
            itemName: (it) => {
                if (firstSeenInscription === null) firstSeenInscription = it.inscription;
                return "sword";
            },
        });
        inscribeItem(item, ctx);
        // The first itemName call (for the prompt) should see the CLEARED inscription
        expect(firstSeenInscription).toBe("");
    });

    it("uses singular pronoun for quantity 1", () => {
        const item = makeItem({ quantity: 1 });
        const messages: string[] = [];
        const ctx = makeCtx("keen", {
            messageWithColor: (msg) => { messages.push(msg); },
        });
        inscribeItem(item, ctx);
        expect(messages[0]).toMatch(/^it's/);
    });

    it("uses plural pronoun for quantity > 1", () => {
        const item = makeItem({ quantity: 3 });
        const messages: string[] = [];
        const ctx = makeCtx("keen", {
            messageWithColor: (msg) => { messages.push(msg); },
        });
        inscribeItem(item, ctx);
        expect(messages[0]).toMatch(/^they're/);
    });
});
