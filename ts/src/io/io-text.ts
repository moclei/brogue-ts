/*
 *  io-text.ts — Text rendering and string utility functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c + src/brogue/Combat.c
 *  Functions: strLenWithoutEscapes, upperCase, breakUpLongWordsIn,
 *             wrapText, printString, printStringWithWrapping,
 *             capitalizeAndPunctuateSentences, splitLines
 *
 *  All functions operate on plain strings (using char codes for color escapes).
 *  Rendering functions write into ScreenDisplayBuffer via plotCharToBuffer.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, ScreenDisplayBuffer } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { COLS, ROWS, COLOR_ESCAPE } from "../types/constants.js";
import { decodeMessageColor } from "./io-color.js";
import { plotCharToBuffer, locIsInWindow } from "./io-display.js";

// =============================================================================
// String measurement
// =============================================================================

/**
 * Get the visible length of a string, ignoring 4-byte color escape sequences.
 *
 * C: `strLenWithoutEscapes` in Combat.c
 */
export function strLenWithoutEscapes(str: string): number {
    let count = 0;
    let i = 0;
    while (i < str.length) {
        if (str.charCodeAt(i) === COLOR_ESCAPE) {
            i += 4;
            continue;
        }
        count++;
        i++;
    }
    return count;
}

// =============================================================================
// Case conversion
// =============================================================================

/**
 * Capitalize the first visible character of a string (skipping color escapes).
 * Returns the modified string.
 *
 * C: `upperCase` in IO.c — the C version takes a char pointer; we return a new string.
 */
export function upperCase(str: string): string {
    let i = 0;
    // Skip leading color escapes
    while (i < str.length && str.charCodeAt(i) === COLOR_ESCAPE) {
        i += 4;
    }
    if (i >= str.length) return str;

    const ch = str.charAt(i);
    if (ch >= "a" && ch <= "z") {
        return str.substring(0, i) + ch.toUpperCase() + str.substring(i + 1);
    }
    return str;
}

// =============================================================================
// Word wrapping
// =============================================================================

/**
 * Break up long words by inserting newlines (and optional hyphens).
 * Respects color escape sequences.
 *
 * C: `breakUpLongWordsIn` (static) in IO.c
 */
export function breakUpLongWordsIn(sourceText: string, width: number, useHyphens: boolean): string {
    let buf = "";
    let wordWidth = 0;

    let i = 0;
    while (i < sourceText.length) {
        if (sourceText.charCodeAt(i) === COLOR_ESCAPE) {
            buf += sourceText.substring(i, i + 4);
            i += 4;
        } else if (sourceText[i] === " " || sourceText[i] === "\n") {
            wordWidth = 0;
            buf += sourceText[i];
            i++;
        } else {
            if (!useHyphens && wordWidth >= width) {
                buf += "\n";
                wordWidth = 0;
            } else if (useHyphens && wordWidth >= width - 1) {
                let nextChar = i + 1;
                while (nextChar < sourceText.length && sourceText.charCodeAt(nextChar) === COLOR_ESCAPE) {
                    nextChar += 4;
                }
                if (
                    nextChar < sourceText.length &&
                    sourceText[nextChar] !== " " &&
                    sourceText[nextChar] !== "\n"
                ) {
                    buf += "-\n";
                    wordWidth = 0;
                }
            }
            buf += sourceText[i];
            i++;
            wordWidth++;
        }
    }
    return buf;
}

/**
 * Word-wrap text to the given width. Returns `{ text, lineCount }`.
 * Color escape sequences are preserved but don't count toward width.
 *
 * C: `wrapText` in IO.c
 */
export function wrapText(sourceText: string, width: number): { text: string; lineCount: number } {
    let printStr = breakUpLongWordsIn(sourceText, width, true);
    const chars = [...printStr]; // work with character array for mutation
    const textLength = chars.length;
    let lineCount = 1;

    // Skip leading color escapes
    let i = 0;
    while (i < textLength && chars[i].charCodeAt(0) === COLOR_ESCAPE) {
        i += 4;
    }
    let spaceLeftOnLine = width;

    while (i < textLength) {
        // Measure next word width (without color escapes)
        let wordWidth = 0;
        let w = i + 1;
        while (w < textLength && chars[w] !== " " && chars[w] !== "\n") {
            if (chars[w].charCodeAt(0) === COLOR_ESCAPE) {
                w += 4;
            } else {
                w++;
                wordWidth++;
            }
        }

        if (1 + wordWidth > spaceLeftOnLine || chars[i] === "\n") {
            chars[i] = "\n";
            lineCount++;
            spaceLeftOnLine = width - wordWidth;
        } else {
            spaceLeftOnLine -= 1 + wordWidth;
        }
        i = w;
    }

    return { text: chars.join(""), lineCount };
}

// =============================================================================
// Text rendering to display buffer
// =============================================================================

/**
 * Render a string into a display buffer at position (x, y).
 * Interprets color escape sequences to change the foreground color mid-string.
 *
 * C: `printString` in IO.c
 */
export function printString(
    theString: string,
    x: number,
    y: number,
    foreColor: Readonly<Color>,
    backColor: Readonly<Color>,
    dbuf: ScreenDisplayBuffer,
): void {
    let fColor: Color = { ...foreColor };

    for (let i = 0; i < theString.length && x < COLS; i++, x++) {
        while (i < theString.length && theString.charCodeAt(i) === COLOR_ESCAPE) {
            const decoded = decodeMessageColor(theString, i);
            fColor = decoded.color;
            i = decoded.nextIndex;
            if (i >= theString.length) return;
        }

        if (i >= theString.length) break;

        plotCharToBuffer(
            theString.charCodeAt(i) as DisplayGlyph,
            x, y,
            fColor, backColor,
            dbuf,
        );
    }
}

/**
 * Word-wrap and render a string. Returns the y-coordinate of the last line.
 *
 * C: `printStringWithWrapping` in IO.c
 */
export function printStringWithWrapping(
    theString: string,
    x: number,
    y: number,
    width: number,
    foreColor: Readonly<Color>,
    backColor: Readonly<Color>,
    dbuf: ScreenDisplayBuffer,
): number {
    const { text: printStr } = wrapText(theString, width);

    let px = x;
    let py = y;
    let fColor: Color = { ...foreColor };

    for (let i = 0; i < printStr.length; i++) {
        if (printStr[i] === "\n") {
            px = x;
            if (py < ROWS - 1) {
                py++;
            } else {
                break;
            }
            continue;
        } else if (printStr.charCodeAt(i) === COLOR_ESCAPE) {
            const decoded = decodeMessageColor(printStr, i);
            fColor = decoded.color;
            i = decoded.nextIndex - 1; // -1 because the for loop will increment
            continue;
        }

        if (locIsInWindow({ windowX: px, windowY: py })) {
            plotCharToBuffer(
                printStr.charCodeAt(i) as DisplayGlyph,
                px, py,
                fColor, backColor,
                dbuf,
            );
        }
        px++;
    }

    return py;
}

// =============================================================================
// Line splitting
// =============================================================================

/**
 * Split newline-delimited wrapped text into buffer rows, carrying color escapes
 * across line breaks. Writes `lineCount` rows into the returned array,
 * positioned so the last line goes at index `bufferCursor`.
 *
 * Each output row is a self-contained string: if the previous line ended with
 * a color in effect, the next row is prefixed with that color escape.
 *
 * C: `splitLines` (static) in IO.c
 *
 * @param lineCount - number of lines in the wrapped text
 * @param wrapped - the newline-delimited wrapped text
 * @param buffer - output array of strings (must be large enough)
 * @param bufferCursor - index of the last output row
 */
export function splitLines(
    lineCount: number,
    wrapped: string,
    buffer: string[],
    bufferCursor: number,
): void {
    let color = "";      // current color escape (4 chars or empty)
    let linesSeen = 0;
    let start = 0;

    for (let end = 0; end <= wrapped.length; end++) {
        if (end < wrapped.length && wrapped.charCodeAt(end) === COLOR_ESCAPE) {
            color = wrapped.substring(end, end + 4);
            end += 3; // the for loop will +1 more, skipping past the 4-byte escape
        } else if (end === wrapped.length || wrapped[end] === "\n") {
            const segment = wrapped.substring(start, end);
            const targetIdx = bufferCursor + 1 - lineCount + linesSeen;

            if (targetIdx >= 0 && targetIdx < buffer.length) {
                // Prepend the carried color to this line's content
                buffer[targetIdx] = color + segment;
            }

            linesSeen++;
            start = end + 1;
        }
    }
}

// =============================================================================
// Sentence processing
// =============================================================================

/**
 * Capitalize and punctuate newline-delimited sentences in place.
 * Handles color escapes and American quotation ordering.
 *
 * C: `capitalizeAndPunctuateSentences` (static) in IO.c
 */
export function capitalizeAndPunctuateSentences(text: string): string {
    const chars = [...text];
    let newSentence = true;

    for (let i = 0; i + 1 < chars.length; i++) {
        if (chars[i].charCodeAt(0) === COLOR_ESCAPE) {
            i += 3; // the loop increment will get the last byte
        } else if (
            chars[i] === '"' &&
            (chars[i + 1] === "." || chars[i + 1] === ",")
        ) {
            // American quotation mark ordering: swap "x to x"
            const temp = chars[i + 1];
            chars[i] = temp;
            chars[i + 1] = '"';
        } else if (chars[i] === "\n") {
            newSentence = true;
        } else if (newSentence) {
            if (chars[i] >= "a" && chars[i] <= "z") {
                chars[i] = chars[i].toUpperCase();
            }
            newSentence = false;
        }
    }

    return chars.join("");
}
