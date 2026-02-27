#!/usr/bin/env node
/**
 * Converts dungeonFeatureCatalog from Globals.c to TypeScript.
 */
const fs = require('fs');
const path = require('path');

const globalsC = fs.readFileSync(
    path.join(__dirname, '../../src/brogue/Globals.c'),
    'utf-8'
);

const lines = globalsC.split('\n');

// dungeonFeatureCatalog entries are from line 605 to 931 (skip declaration line and header comment)
const catalogLines = lines.slice(604, 932);

// Strip trailing C comments outside strings
function stripTrailingComment(line) {
    let inStr = false;
    for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '"' && (i === 0 || line[i-1] !== '\\')) inStr = !inStr;
        if (!inStr && line[i] === '/' && line[i+1] === '/') {
            return line.substring(0, i).trim();
        }
    }
    return line;
}

// Parse entries from the catalog
const entries = [];
let current = '';
for (const line of catalogLines) {
    let trimmed = line.trim();
    if (!trimmed || (trimmed.startsWith('//') && !current)) {
        if (current) { entries.push(current); current = ''; }
        if (trimmed.startsWith('//')) entries.push('COMMENT:' + trimmed);
        continue;
    }
    trimmed = stripTrailingComment(trimmed);
    current += ' ' + trimmed;
    if (trimmed.endsWith('},')) {
        entries.push(current.trim());
        current = '';
    }
}
if (current.trim()) entries.push(current.trim());

// Fields in order: tile, layer, startProbability, probabilityDecrement, flags, description, lightFlare, flashColor, effectRadius, propagationTerrain, subsequentDF, messageDisplayed
const fieldNames = ['tile', 'layer', 'startProbability', 'probabilityDecrement', 'flags', 'description', 'lightFlare', 'flashColor', 'effectRadius', 'propagationTerrain', 'subsequentDF', 'messageDisplayed'];
const fieldDefaults = ['0', '0', '0', '0', '0', '""', '0', '0', '0', '0', '0', 'false'];

// DFFlags composites
const compositeDFFlags = new Set([
    // none known yet
]);

function parseFields(body) {
    const fields = [];
    let depth = 0, inString = false, escaped = false, field = '';
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (escaped) { field += ch; escaped = false; continue; }
        if (ch === '\\') { field += ch; escaped = true; continue; }
        if (ch === '"') { field += ch; inString = !inString; continue; }
        if (inString) { field += ch; continue; }
        if (ch === '(') { depth++; field += ch; continue; }
        if (ch === ')') { depth--; field += ch; continue; }
        if (ch === ',' && depth === 0) { fields.push(field.trim()); field = ''; continue; }
        field += ch;
    }
    if (field.trim()) fields.push(field.trim());
    return fields;
}

function convertTile(t) {
    t = t.trim();
    if (t === '0') return 'TileType.NOTHING';
    return `TileType.${t}`;
}

// Map C layer names to TypeScript PascalCase enum values
const layerMap = { 'DUNGEON': 'Dungeon', 'LIQUID': 'Liquid', 'GAS': 'Gas', 'SURFACE': 'Surface' };
function convertLayer(l) {
    l = l.trim();
    if (l === '0') return 'DungeonLayer.Dungeon';
    return `DungeonLayer.${layerMap[l] || l}`;
}

function convertFlags(f) {
    f = f.trim();
    if (f === '0' || f === '(0)') return '0';
    let inner = f;
    if (inner.startsWith('(') && inner.endsWith(')')) inner = inner.slice(1, -1);
    return inner.split('|').map(p => {
        p = p.trim();
        return `DFF.${p}`;
    }).join(' | ');
}

function convertLight(l) {
    l = l.trim();
    if (l === '0') return 'LightType.NO_LIGHT';
    return `LightType.${l}`;
}

function convertColor(col) {
    col = col.trim();
    if (col === '0') return 'null';
    return `C.${col.replace(/^&/, '')}`;
}

function convertPropTerrain(t) {
    t = t.trim();
    if (t === '0') return '0';
    return `TileType.${t}`;
}

function convertSubseqDF(d) {
    d = d.trim();
    if (d === '0') return '0';
    return `DungeonFeatureType.${d}`;
}

function convertBool(b) {
    b = b.trim();
    if (b === '0' || b === 'false') return 'false';
    return 'true';
}

// effectRadius can contain expressions like DCOLS/2 or TileType enum names used as ints
function convertEffectRadius(r) {
    r = r.trim();
    if (r === '0') return '0';
    // Handle DCOLS/2 expression
    if (r.includes('DCOLS')) return r; // Pass through — DCOLS is imported
    // Handle TileType enum values used as raw ints (e.g., GRANITE = 1)
    // These are C-isms; replace with the numeric value
    const tileTypeValues = { 'GRANITE': 1, 'WALL': 6 };
    if (tileTypeValues[r] !== undefined) return `${tileTypeValues[r]} /* ${r} */`;
    return r;
}

const converters = [convertTile, convertLayer, String, String, convertFlags, String, convertLight, convertColor, convertEffectRadius, convertPropTerrain, convertSubseqDF, convertBool];

const out = [];
out.push(`/*`);
out.push(` *  dungeon-feature-catalog.ts — dungeonFeatureCatalog, ported from Globals.c`);
out.push(` *  brogue-ts`);
out.push(` *`);
out.push(` *  This program is free software: you can redistribute it and/or modify`);
out.push(` *  it under the terms of the GNU Affero General Public License as`);
out.push(` *  published by the Free Software Foundation, either version 3 of the`);
out.push(` *  License, or (at your option) any later version.`);
out.push(` */`);
out.push(``);
out.push(`import type { DungeonFeature } from "../types/types.js";`);
out.push(`import { TileType, DungeonLayer, DungeonFeatureType, LightType } from "../types/enums.js";`);
out.push(`import { DFFlag as DFF } from "../types/flags.js";`);
out.push(`import { DCOLS } from "../types/constants.js";`);
out.push(`import * as C from "./colors.js";`);
out.push(``);
out.push(`/**`);
out.push(` * Dungeon feature catalog. Each entry defines a terrain feature that can be`);
out.push(` * spawned during dungeon generation or gameplay. Indexed by DungeonFeatureType.`);
out.push(` */`);
out.push(`export const dungeonFeatureCatalog: DungeonFeature[] = [`);

let entryCount = 0;
for (const entry of entries) {
    if (entry.startsWith('COMMENT:')) {
        out.push(`    ${entry.slice(8)}`);
        continue;
    }

    // Extract body from {...}
    const openBrace = entry.indexOf('{');
    if (openBrace === -1) continue;
    const closeBrace = entry.lastIndexOf('}');
    if (closeBrace <= openBrace) continue;
    const body = entry.substring(openBrace + 1, closeBrace).trim();

    // Parse fields
    const fields = parseFields(body);

    // Pad with defaults
    while (fields.length < fieldNames.length) {
        fields.push(fieldDefaults[fields.length]);
    }

    // Convert each field
    const converted = fields.map((f, i) => converters[i](f));

    out.push(`    { // ${entryCount}`);
    out.push(`        tile: ${converted[0]},`);
    out.push(`        layer: ${converted[1]},`);
    out.push(`        startProbability: ${converted[2]},`);
    out.push(`        probabilityDecrement: ${converted[3]},`);
    out.push(`        flags: ${converted[4]},`);
    out.push(`        description: ${converted[5]},`);
    out.push(`        lightFlare: ${converted[6]},`);
    out.push(`        flashColor: ${converted[7]},`);
    out.push(`        effectRadius: ${converted[8]},`);
    out.push(`        propagationTerrain: ${converted[9]},`);
    out.push(`        subsequentDF: ${converted[10]},`);
    out.push(`        messageDisplayed: ${converted[11]},`);
    out.push(`    },`);
    entryCount++;
}

out.push(`];`);
out.push(``);

console.log(out.join('\n'));
console.error(`Generated ${entryCount} entries`);
