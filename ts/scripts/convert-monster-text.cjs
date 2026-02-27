#!/usr/bin/env node
/**
 * Converts monsterText from Globals.c to TypeScript.
 */
const fs = require('fs');
const path = require('path');

const globalsC = fs.readFileSync(
    path.join(__dirname, '../../src/brogue/Globals.c'),
    'utf-8'
);

const lines = globalsC.split('\n');
// monsterText: lines 1167 to 1394 (0-indexed 1167..1393)
const catalogLines = lines.slice(1167, 1394);

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

// Merge multi-line entries
const entries = [];
let current = '';
let braceDepth = 0;
for (const line of catalogLines) {
    let trimmed = stripTrailingComment(line.trim());
    if (!trimmed || (trimmed.startsWith('//') && braceDepth === 0)) continue;

    current += ' ' + trimmed;
    for (const ch of trimmed) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
    }

    // An entry is complete when we return to depth 0 after having been deeper
    if (braceDepth === 0 && current.trim()) {
        entries.push(current.trim());
        current = '';
    }
}

// Parse each entry
function parseEntry(text) {
    // Entry format: {"flavorText", "absorbing", "absorbStatus", {"attack1", "attack2", ..., {0}}},
    // Some entries have 5 or 6 fields (with DFMessage and summonMessage)

    // Remove outer braces and trailing comma
    let inner = text.replace(/^\{/, '').replace(/\}\s*,?\s*$/, '').trim();

    // Split into top-level fields respecting nesting
    const fields = [];
    let depth = 0, inStr = false, escaped = false, field = '';
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (escaped) { field += ch; escaped = false; continue; }
        if (ch === '\\') { field += ch; escaped = true; continue; }
        if (ch === '"') { field += ch; inStr = !inStr; continue; }
        if (inStr) { field += ch; continue; }
        if (ch === '{') { depth++; field += ch; continue; }
        if (ch === '}') { depth--; field += ch; continue; }
        if (ch === ',' && depth === 0) { fields.push(field.trim()); field = ''; continue; }
        field += ch;
    }
    if (field.trim()) fields.push(field.trim());

    const flavorText = fields[0] || '""';
    const absorbing = fields[1] || '""';
    const absorbStatus = fields[2] || '""';

    // Parse attack array from fields[3] — format: {"attack1", "attack2", ..., {0}}
    let attacks = [];
    if (fields[3]) {
        const attackStr = fields[3].replace(/^\{/, '').replace(/\}\s*$/, '').trim();
        // Split on comma, ignoring {0}
        const parts = [];
        let d = 0, s = false, e = false, f = '';
        for (let i = 0; i < attackStr.length; i++) {
            const ch = attackStr[i];
            if (e) { f += ch; e = false; continue; }
            if (ch === '\\') { f += ch; e = true; continue; }
            if (ch === '"') { f += ch; s = !s; continue; }
            if (s) { f += ch; continue; }
            if (ch === '{') { d++; f += ch; continue; }
            if (ch === '}') { d--; f += ch; continue; }
            if (ch === ',' && d === 0) { parts.push(f.trim()); f = ''; continue; }
            f += ch;
        }
        if (f.trim()) parts.push(f.trim());

        attacks = parts.filter(p => !p.match(/^\{0\}$/)).map(p => p);
    }

    let DFMessage = fields[4] || '""';
    if (DFMessage.match(/^\{0\}$/)) DFMessage = '""';
    let summonMessage = fields[5] || '""';
    if (summonMessage.match(/^\{0\}$/)) summonMessage = '""';

    return { flavorText, absorbing, absorbStatus, attacks, DFMessage, summonMessage };
}

const out = [];
out.push(`/*`);
out.push(` *  monster-text.ts — monsterText catalog, ported from Globals.c`);
out.push(` *  brogue-ts`);
out.push(` */`);
out.push(``);
out.push(`import type { MonsterWords } from "../types/types.js";`);
out.push(``);
out.push(`/**`);
out.push(` * Monster text catalog. Each entry provides flavor text, absorption descriptions,`);
out.push(` * and attack verb arrays for each monster type.`);
out.push(` * Indexed by MonsterType enum.`);
out.push(` */`);
out.push(`export const monsterText: readonly MonsterWords[] = [`);

let count = 0;
for (const entry of entries) {
    if (entry === '};') continue;

    const e = parseEntry(entry);
    const attackArr = e.attacks.length > 0 ? `[${e.attacks.join(', ')}]` : '[]';

    out.push(`    { // ${count}`);
    out.push(`        flavorText: ${e.flavorText},`);
    out.push(`        absorbing: ${e.absorbing},`);
    out.push(`        absorbStatus: ${e.absorbStatus},`);
    out.push(`        attack: ${attackArr},`);
    out.push(`        DFMessage: ${e.DFMessage},`);
    out.push(`        summonMessage: ${e.summonMessage},`);
    out.push(`    },`);
    count++;
}

out.push(`];`);
out.push(``);
console.log(out.join('\n'));
console.error(`Generated ${count} entries`);
