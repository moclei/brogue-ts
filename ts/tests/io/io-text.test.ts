/*
 *  io-text.test.ts — Tests for io-text.ts (text rendering utilities)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { seedRandomGenerator } from "../../src/math/rng.js";
import { COLS, ROWS, COLOR_ESCAPE, COLOR_VALUE_INTERCEPT } from "../../src/types/constants.js";
import type { Color } from "../../src/types/types.js";
import {
    strLenWithoutEscapes,
    upperCase,
    breakUpLongWordsIn,
    wrapText,
    printString,
    printStringWithWrapping,
    capitalizeAndPunctuateSentences,
} from "../../src/io/io-text.js";
import { createScreenDisplayBuffer } from "../../src/io/io-display.js";

// =============================================================================
// Helpers
// =============================================================================

/** Build a 4-byte color escape string from r, g, b values (0-100). */
function colorEsc(r: number, g: number, b: number): string {
    return (
        String.fromCharCode(COLOR_ESCAPE) +
        String.fromCharCode(COLOR_VALUE_INTERCEPT + r) +
        String.fromCharCode(COLOR_VALUE_INTERCEPT + g) +
        String.fromCharCode(COLOR_VALUE_INTERCEPT + b)
    );
}

function makeColor(
    red = 0, green = 0, blue = 0,
    redRand = 0, greenRand = 0, blueRand = 0,
    rand = 0, colorDances = false,
): Color {
    return { red, green, blue, redRand, greenRand, blueRand, rand, colorDances };
}

// =============================================================================
// strLenWithoutEscapes
// =============================================================================

describe("strLenWithoutEscapes", () => {
    it("counts plain ASCII characters", () => {
        expect(strLenWithoutEscapes("hello")).toBe(5);
    });

    it("returns 0 for empty string", () => {
        expect(strLenWithoutEscapes("")).toBe(0);
    });

    it("ignores 4-byte color escapes", () => {
        const str = "ab" + colorEsc(50, 50, 50) + "cd";
        expect(strLenWithoutEscapes(str)).toBe(4); // a, b, c, d
    });

    it("handles multiple consecutive escapes", () => {
        const str = colorEsc(0, 0, 0) + colorEsc(100, 0, 0) + "x";
        expect(strLenWithoutEscapes(str)).toBe(1);
    });

    it("handles escape at end of string", () => {
        const str = "abc" + colorEsc(0, 0, 0);
        expect(strLenWithoutEscapes(str)).toBe(3);
    });
});

// =============================================================================
// upperCase
// =============================================================================

describe("upperCase", () => {
    it("capitalizes the first character", () => {
        expect(upperCase("hello")).toBe("Hello");
    });

    it("does nothing to already uppercase strings", () => {
        expect(upperCase("Hello")).toBe("Hello");
    });

    it("skips leading color escapes", () => {
        const esc = colorEsc(50, 50, 50);
        const result = upperCase(esc + "hello");
        expect(result).toBe(esc + "Hello");
    });

    it("handles empty string", () => {
        expect(upperCase("")).toBe("");
    });

    it("handles string of only color escapes", () => {
        const esc = colorEsc(50, 50, 50);
        expect(upperCase(esc)).toBe(esc);
    });
});

// =============================================================================
// breakUpLongWordsIn
// =============================================================================

describe("breakUpLongWordsIn", () => {
    it("inserts hyphen-newline for long words with useHyphens=true", () => {
        // width=5, so after 4 chars (width-1) it should insert hyphen-newline
        const result = breakUpLongWordsIn("abcdefgh", 5, true);
        expect(result).toContain("-\n");
        // After inserting a break, word continues
        expect(result).toBe("abcd-\nefgh");
    });

    it("inserts just newline for long words with useHyphens=false", () => {
        const result = breakUpLongWordsIn("abcdefgh", 5, false);
        expect(result).toContain("\n");
        expect(result).toBe("abcde\nfgh");
    });

    it("preserves color escapes", () => {
        const esc = colorEsc(50, 50, 50);
        const result = breakUpLongWordsIn("ab" + esc + "cd", 100, true);
        expect(result).toBe("ab" + esc + "cd");
    });

    it("resets word width on spaces", () => {
        const result = breakUpLongWordsIn("abc def", 5, true);
        // Neither word is longer than 5, so no breaks
        expect(result).toBe("abc def");
    });

    it("handles short words without modification", () => {
        expect(breakUpLongWordsIn("hi", 10, true)).toBe("hi");
    });
});

// =============================================================================
// wrapText
// =============================================================================

describe("wrapText", () => {
    it("returns 1 line for short text", () => {
        const { text, lineCount } = wrapText("hello world", 40);
        expect(lineCount).toBe(1);
        expect(text).toBe("hello world");
    });

    it("wraps words that exceed line width", () => {
        const { text, lineCount } = wrapText("hello world", 7);
        expect(lineCount).toBe(2);
        expect(text).toContain("\n");
    });

    it("preserves existing newlines", () => {
        const { text, lineCount } = wrapText("line1\nline2", 40);
        expect(lineCount).toBe(2);
        expect(text).toContain("\n");
    });

    it("counts color escapes correctly (no visible width)", () => {
        const esc = colorEsc(50, 50, 50);
        const { text, lineCount } = wrapText(esc + "hi " + esc + "there", 20);
        expect(lineCount).toBe(1);
    });
});

// =============================================================================
// printString
// =============================================================================

describe("printString", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("renders plain text to display buffer", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        printString("AB", 5, 5, fore, back, buf);

        // 'A' = 65, 'B' = 66
        expect(buf.cells[5][5].character).toBe(65);
        expect(buf.cells[6][5].character).toBe(66);
    });

    it("stops at COLS boundary", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        // Start near the right edge
        const longStr = "A".repeat(10);
        printString(longStr, COLS - 3, 0, fore, back, buf);

        // Only 3 characters should be written (COLS-3, COLS-2, COLS-1)
        expect(buf.cells[COLS - 3][0].character).toBe(65);
        expect(buf.cells[COLS - 2][0].character).toBe(65);
        expect(buf.cells[COLS - 1][0].character).toBe(65);
    });

    it("handles inline color escapes", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        // "A" followed by a red color escape, then "B"
        const str = "A" + colorEsc(80, 0, 0) + "B";
        printString(str, 5, 5, fore, back, buf);

        // 'A' should be at (5,5) with the original foreColor
        expect(buf.cells[5][5].character).toBe(65);
        expect(buf.cells[5][5].foreColorComponents[0]).toBe(100); // original white-ish

        // 'B' at (6,5) should use the decoded red color
        expect(buf.cells[6][5].character).toBe(66);
        expect(buf.cells[6][5].foreColorComponents[0]).toBe(80); // red component from escape
    });

    it("handles empty string", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        // Should not throw
        printString("", 5, 5, fore, back, buf);
        expect(buf.cells[5][5].character).toBe(32); // untouched (default is space)
    });
});

// =============================================================================
// printStringWithWrapping
// =============================================================================

describe("printStringWithWrapping", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("renders text that fits in one line", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        const lastY = printStringWithWrapping("Hello", 5, 5, 40, fore, back, buf);
        expect(lastY).toBe(5); // stays on same line

        // 'H' = 72 at (5, 5)
        expect(buf.cells[5][5].character).toBe(72);
    });

    it("wraps to next line and returns correct y", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        // "abc def" with width 4: "abc\ndef" (two lines)
        const lastY = printStringWithWrapping("abc def", 5, 5, 4, fore, back, buf);
        expect(lastY).toBe(6);
    });

    it("stops at bottom of screen", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        // Create text with many lines
        const lines = Array(ROWS + 5).fill("word").join(" ");
        const lastY = printStringWithWrapping(lines, 0, 0, 5, fore, back, buf);
        expect(lastY).toBeLessThanOrEqual(ROWS - 1);
    });

    it("handles color escapes within wrapped text", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);

        const str = "hi " + colorEsc(80, 0, 0) + "there";
        const lastY = printStringWithWrapping(str, 5, 5, 40, fore, back, buf);
        expect(lastY).toBe(5);
    });
});

// =============================================================================
// capitalizeAndPunctuateSentences
// =============================================================================

describe("capitalizeAndPunctuateSentences", () => {
    it("capitalizes first character", () => {
        expect(capitalizeAndPunctuateSentences("hello world. ")).toBe("Hello world. ");
    });

    it("capitalizes after newline", () => {
        const result = capitalizeAndPunctuateSentences("first.\nsecond.");
        expect(result).toBe("First.\nSecond.");
    });

    it("applies American quotation mark ordering", () => {
        const result = capitalizeAndPunctuateSentences('He said "hello". ');
        // The ". should become ."
        expect(result).toBe('He said "hello." ');
    });

    it("handles color escapes within text", () => {
        const esc = colorEsc(50, 50, 50);
        const result = capitalizeAndPunctuateSentences(esc + "hello");
        // Should capitalize 'h' after the escape
        expect(result).toBe(esc + "Hello");
    });

    it("handles empty string", () => {
        expect(capitalizeAndPunctuateSentences("")).toBe("");
    });

    it("handles single character", () => {
        // Single char — i+1 < length is false, so no processing
        expect(capitalizeAndPunctuateSentences("a")).toBe("a");
    });
});
