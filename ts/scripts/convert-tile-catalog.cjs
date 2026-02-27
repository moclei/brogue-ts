#!/usr/bin/env node
/**
 * Script to convert tileCatalog from C to TypeScript.
 * Reads tileCatalog entries from Globals.c and outputs TypeScript.
 */

const fs = require('fs');
const path = require('path');

const globalsC = fs.readFileSync(
    path.join(__dirname, '../../src/brogue/Globals.c'),
    'utf-8'
);

const lines = globalsC.split('\n');

// Extract tileCatalog entries (lines 321 to 578, 0-indexed 320-577)
const catalogLines = lines.slice(320, 579);

// Merge continuation lines
const entries = [];
let current = '';
for (const line of catalogLines) {
    let trimmed = line.trim();
    if (!trimmed || (trimmed.startsWith('//') && !current)) {
        if (current) {
            entries.push(current);
            current = '';
        }
        if (trimmed.startsWith('//')) {
            entries.push('COMMENT:' + trimmed);
        }
        continue;
    }
    // Strip trailing C comments (// ...) from data lines
    // Find the LAST occurrence of // that's NOT inside a string
    let stripIdx = -1;
    {
        let inStr = false;
        for (let i = 0; i < trimmed.length - 1; i++) {
            if (trimmed[i] === '"' && (i === 0 || trimmed[i-1] !== '\\')) inStr = !inStr;
            if (!inStr && trimmed[i] === '/' && trimmed[i+1] === '/') {
                stripIdx = i;
                // Don't break — we want the LAST one outside strings, but actually any // outside a string starts a comment, so this is fine
                break;
            }
        }
    }
    if (stripIdx > 0) {
        trimmed = trimmed.substring(0, stripIdx).trim();
    }
    current += ' ' + trimmed;
    if (trimmed.endsWith('},')) {
        entries.push(current.trim());
        current = '';
    }
}
if (current.trim()) entries.push(current.trim());

// Composite flags that are standalone exports (not inside TerrainFlag/TerrainMechFlag objects)
const compositeTerrainFlags = new Set([
    'T_OBSTRUCTS_EVERYTHING', 'T_OBSTRUCTS_SCENT', 'T_PATHING_BLOCKER',
    'T_DIVIDES_LEVEL', 'T_LAKE_PATHING_BLOCKER', 'T_WAYPOINT_BLOCKER',
    'T_MOVES_ITEMS', 'T_CAN_BE_BRIDGED', 'T_HARMFUL_TERRAIN',
    'T_RESPIRATION_IMMUNITIES',
]);

const compositeMechFlags = new Set([
    'TM_PROMOTES_ON_STEP',
]);

function convertTerrainFlag(flag) {
    flag = flag.trim();
    if (compositeTerrainFlags.has(flag)) {
        return flag; // standalone export, import directly
    }
    return `TF.${flag}`;
}

function convertMechFlag(flag) {
    return `TM.${flag.trim()}`;
}

function convertFlags(flagsStr, converter) {
    const s = flagsStr.trim();
    if (s === '0' || s === '(0)') return '0';
    let inner = s;
    if (inner.startsWith('(') && inner.endsWith(')')) {
        inner = inner.slice(1, -1);
    }
    const parts = inner.split('|').map(p => converter(p));
    return parts.join(' | ');
}

// Collect all terrain flags and mech flags used
const terrainFlagsUsed = new Set();
const mechFlagsUsed = new Set();
const compositeUsed = new Set();
const displayGlyphsUsed = new Set();
const dfTypesUsed = new Set();
const lightTypesUsed = new Set();
const colorsUsed = new Set();

const parsedEntries = [];

for (const entry of entries) {
    if (entry.startsWith('COMMENT:')) {
        parsedEntries.push({ type: 'comment', text: entry.slice(8) });
        continue;
    }

    // Extract name from /*NAME*/ and body from {...}
    const nameMatch = entry.match(/\/\*([^*]+)\*\//);
    if (!nameMatch) {
        parsedEntries.push({ type: 'unparsed', text: entry });
        continue;
    }
    const name = nameMatch[1].replace(/,\s*$/, '').trim();

    // Find the opening { and closing } to extract the body
    const openBrace = entry.indexOf('{', nameMatch.index + nameMatch[0].length);
    if (openBrace === -1) {
        parsedEntries.push({ type: 'unparsed', text: entry });
        continue;
    }
    // Find the last } in the entry
    const closeBrace = entry.lastIndexOf('}');
    if (closeBrace <= openBrace) {
        parsedEntries.push({ type: 'unparsed', text: entry });
        continue;
    }
    const body = entry.substring(openBrace + 1, closeBrace).trim();

    // Parse body respecting nested parens and strings
    const fields = [];
    let depth = 0;
    let inString = false;
    let escaped = false;
    let field = '';

    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (escaped) { field += ch; escaped = false; continue; }
        if (ch === '\\') { field += ch; escaped = true; continue; }
        if (ch === '"') { field += ch; inString = !inString; continue; }
        if (inString) { field += ch; continue; }
        if (ch === '(') { depth++; field += ch; continue; }
        if (ch === ')') { depth--; field += ch; continue; }
        if (ch === ',' && depth === 0) {
            fields.push(field.trim());
            field = '';
            continue;
        }
        field += ch;
    }
    if (field.trim()) fields.push(field.trim());

    if (fields.length < 14) {
        parsedEntries.push({ type: 'error', text: entry, count: fields.length });
        continue;
    }

    const [displayChar, foreColor, backColor, drawPriority, chanceToIgnite,
           fireType, discoverType, promoteType, promoteChance, glowLight,
           flags, mechFlags, description, flavorText] = fields;

    // Convert display char
    let tsChar = displayChar.trim();
    if (tsChar === '0') {
        tsChar = '0 /* null */';
    } else if (tsChar.startsWith("'")) {
        const c = tsChar.replace(/'/g, '');
        tsChar = `${c.charCodeAt(0)} /* '${c}' */`;
    } else if (tsChar.startsWith('G_')) {
        displayGlyphsUsed.add(tsChar);
        tsChar = `DisplayGlyph.${tsChar}`;
    }

    // Convert colors (0 = null pointer in C => undefined)
    const foreColorRaw = foreColor.replace(/^&/, '').trim();
    const backColorRaw = backColor.replace(/^&/, '').trim();
    const tsFore = foreColorRaw === '0' ? 'undefined' : `C.${foreColorRaw}`;
    const tsBack = backColorRaw === '0' ? 'undefined' : `C.${backColorRaw}`;
    if (foreColorRaw !== '0') colorsUsed.add(foreColorRaw);
    if (backColorRaw !== '0') colorsUsed.add(backColorRaw);

    // Convert DF types — keep the DF_ prefix since enum members include it
    function convertDF(df) {
        const d = df.trim();
        if (d === '0') return '0';
        dfTypesUsed.add(d);
        return `DungeonFeatureType.${d}`;
    }
    const tsFireType = convertDF(fireType);
    const tsDiscoverType = convertDF(discoverType);
    const tsPromoteType = convertDF(promoteType);

    // Convert light type
    let tsLight = glowLight.trim();
    if (tsLight === 'NO_LIGHT' || tsLight === '0') {
        tsLight = 'LightType.NO_LIGHT';
        lightTypesUsed.add('NO_LIGHT');
    } else {
        lightTypesUsed.add(tsLight);
        tsLight = `LightType.${tsLight}`;
    }

    // Convert flags
    const tsFlags = convertFlags(flags, f => {
        f = f.trim();
        if (compositeTerrainFlags.has(f)) {
            compositeUsed.add(f);
            return f;
        }
        terrainFlagsUsed.add(f);
        return `TF.${f}`;
    });

    const tsMechFlags = convertFlags(mechFlags, f => {
        f = f.trim();
        if (compositeMechFlags.has(f)) {
            compositeUsed.add(f);
            return f;
        }
        mechFlagsUsed.add(f);
        return `TM.${f}`;
    });

    parsedEntries.push({
        type: 'entry',
        name,
        tsChar, tsFore, tsBack, drawPriority: drawPriority.trim(),
        chanceToIgnite: chanceToIgnite.trim(),
        tsFireType, tsDiscoverType, tsPromoteType,
        promoteChance: promoteChance.trim(),
        tsLight, tsFlags, tsMechFlags,
        description: description.trim(), flavorText: flavorText.trim(),
    });
}

// Generate output
const out = [];
out.push(`/*`);
out.push(` *  tile-catalog.ts — tileCatalog, ported from Globals.c`);
out.push(` *  brogue-ts`);
out.push(` *`);
out.push(` *  This program is free software: you can redistribute it and/or modify`);
out.push(` *  it under the terms of the GNU Affero General Public License as`);
out.push(` *  published by the Free Software Foundation, either version 3 of the`);
out.push(` *  License, or (at your option) any later version.`);
out.push(` */`);
out.push(``);
out.push(`import type { FloorTileType } from "../types/types.js";`);
out.push(`import { DisplayGlyph, DungeonFeatureType, LightType } from "../types/enums.js";`);

// Build composite imports
const compositeImports = [...compositeUsed].sort();
out.push(`import { TerrainFlag as TF, TerrainMechFlag as TM${compositeImports.length ? ', ' + compositeImports.join(', ') : ''} } from "../types/flags.js";`);
out.push(`import * as C from "./colors.js";`);
out.push(``);
out.push(`/**`);
out.push(` * The master tile catalog. Each entry defines a tile type's appearance,`);
out.push(` * behavior, and text descriptions. Indexed by the TileType enum.`);
out.push(` */`);
out.push(`export const tileCatalog: readonly FloorTileType[] = [`);

for (const e of parsedEntries) {
    if (e.type === 'comment') {
        out.push(`    ${e.text}`);
    } else if (e.type === 'unparsed' || e.type === 'error') {
        // skip closing brace
        if (e.text === '};') continue;
        out.push(`    // UNPARSED: ${e.text}`);
    } else {
        out.push(`    // ${e.name}`);
        out.push(`    {`);
        out.push(`        displayChar: ${e.tsChar},`);
        out.push(`        foreColor: ${e.tsFore},`);
        out.push(`        backColor: ${e.tsBack},`);
        out.push(`        drawPriority: ${e.drawPriority},`);
        out.push(`        chanceToIgnite: ${e.chanceToIgnite},`);
        out.push(`        fireType: ${e.tsFireType},`);
        out.push(`        discoverType: ${e.tsDiscoverType},`);
        out.push(`        promoteType: ${e.tsPromoteType},`);
        out.push(`        promoteChance: ${e.promoteChance},`);
        out.push(`        glowLight: ${e.tsLight},`);
        out.push(`        flags: ${e.tsFlags},`);
        out.push(`        mechFlags: ${e.tsMechFlags},`);
        out.push(`        description: ${e.description},`);
        out.push(`        flavorText: ${e.flavorText},`);
        out.push(`    },`);
    }
}

out.push(`];`);
out.push(``);

console.log(out.join('\n'));
