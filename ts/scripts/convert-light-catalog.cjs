#!/usr/bin/env node
/**
 * Converts lightCatalog from Globals.c to TypeScript.
 */
const fs = require('fs');
const path = require('path');

const globalsC = fs.readFileSync(
    path.join(__dirname, '../../src/brogue/Globals.c'),
    'utf-8'
);

const lines = globalsC.split('\n');

// lightCatalog: lines 957 to 1021 (0-indexed 956..1020)
const catalogLines = lines.slice(956, 1021);

function stripTrailingComment(line) {
    let inStr = false;
    for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '"' && (i === 0 || line[i-1] !== '\\')) inStr = !inStr;
        if (!inStr && line[i] === '/' && line[i+1] === '/') {
            return { text: line.substring(0, i).trim(), comment: line.substring(i + 2).trim() };
        }
    }
    return { text: line, comment: '' };
}

const out = [];
out.push(`/*`);
out.push(` *  light-catalog.ts — lightCatalog, ported from Globals.c`);
out.push(` *  brogue-ts`);
out.push(` */`);
out.push(``);
out.push(`import type { LightSource } from "../types/types.js";`);
out.push(`import type { Color } from "../types/types.js";`);
out.push(`import { DCOLS } from "../types/constants.js";`);
out.push(`import * as C from "./colors.js";`);
out.push(``);
out.push(`const NO_COLOR: Color = { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };`);
out.push(``);
out.push(`/**`);
out.push(` * Light source catalog. Each entry defines a light source's color, radius,`);
out.push(` * fade percentage, and creature pass-through behavior.`);
out.push(` * Indexed by LightType enum.`);
out.push(` */`);
out.push(`export const lightCatalog: readonly LightSource[] = [`);

let count = 0;
for (const line of catalogLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) {
        out.push(`    ${trimmed}`);
        continue;
    }

    const { text, comment } = stripTrailingComment(trimmed);
    
    // Handle {0} entry
    if (text.match(/^\{0\}\s*,?\s*$/)) {
        out.push(`    // ${comment || 'no light'}`);
        out.push(`    { lightColor: NO_COLOR, lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, radialFadeToPercent: 0, passThroughCreatures: false },`);
        count++;
        continue;
    }

    // Parse: {&colorName, {r1, r2, r3}, fade, passThrough},
    const m = text.match(/\{(&\w+)\s*,\s*\{([^}]+)\}\s*,\s*(\d+)\s*,\s*(true|false)\s*\}\s*,?\s*$/);
    if (!m) {
        out.push(`    // UNPARSED: ${text}`);
        continue;
    }

    const colorRef = m[1].replace(/^&/, '');
    const radiusParts = m[2].split(',').map(s => s.trim());
    const fade = m[3];
    const passThrough = m[4];

    out.push(`    // ${comment}`);
    out.push(`    { lightColor: C.${colorRef}, lightRadius: { lowerBound: ${radiusParts[0]}, upperBound: ${radiusParts[1]}, clumpFactor: ${radiusParts[2]} }, radialFadeToPercent: ${fade}, passThroughCreatures: ${passThrough} },`);
    count++;
}

out.push(`];`);
out.push(``);
console.log(out.join('\n'));
console.error(`Generated ${count} entries`);
