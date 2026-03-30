#!/usr/bin/env node
/**
 * Merge CodeQL query results into a single C function manifest.
 *
 * Usage: node merge-codeql-results.mjs <functions.txt> <callgraph.txt> <params.txt> <output.json>
 *
 * Input files are CodeQL text-format tables (pipe-delimited with header row + separator).
 */

import { readFileSync, writeFileSync } from 'fs';

const FILE_TO_SYSTEM = {
  'Architect.c': 'dungeon-gen',
  'Buttons.c': 'ui',
  'Combat.c': 'combat',
  'Dijkstra.c': 'pathfinding',
  'Globals.c': 'globals',
  'GlobalsBase.c': 'globals',
  'Grid.c': 'grid',
  'IO.c': 'io',
  'Items.c': 'items',
  'Light.c': 'lighting',
  'MainMenu.c': 'menus',
  'Math.c': 'math',
  'Monsters.c': 'monsters',
  'Movement.c': 'movement',
  'PowerTables.c': 'tables',
  'Recordings.c': 'recording',
  'RogueMain.c': 'lifecycle',
  'SeedCatalog.c': 'lifecycle',
  'Time.c': 'turn',
  'Utilities.c': 'util',
  'Wizard.c': 'debug',
  'Rogue.h': 'core',
  'Globals.h': 'globals',
  'GlobalsBase.h': 'globals',
};

function parseTable(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);

  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = cells[j]; });
    rows.push(row);
  }
  return rows;
}

function classifyFile(filePath) {
  const basename = filePath.split('/').pop();
  return FILE_TO_SYSTEM[basename] || 'unknown';
}

const [,, functionsFile, callgraphFile, paramsFile, outputFile] = process.argv;
if (!functionsFile || !callgraphFile || !paramsFile || !outputFile) {
  console.error('Usage: node merge-codeql-results.mjs <functions.txt> <callgraph.txt> <params.txt> <output.json>');
  process.exit(1);
}

const funcRows = parseTable(readFileSync(functionsFile, 'utf8'));
const callRows = parseTable(readFileSync(callgraphFile, 'utf8'));
const paramRows = parseTable(readFileSync(paramsFile, 'utf8'));

const functions = {};
const systems = {};

for (const row of funcRows) {
  const name = row.name;
  const system = classifyFile(row.file);

  functions[name] = {
    file: row.file,
    line: parseInt(row.startLine, 10),
    endLine: parseInt(row.endLine, 10),
    returnType: row.returnType || 'void',
    system,
    params: [],
    callers: [],
    callees: [],
  };

  if (!systems[system]) systems[system] = [];
  systems[system].push(name);
}

for (const row of paramRows) {
  const fn = functions[row.func];
  if (!fn) continue;
  fn.params.push({
    index: parseInt(row.paramIndex, 10),
    name: row.paramName,
    type: row.paramType,
  });
}

for (const fn of Object.values(functions)) {
  fn.params.sort((a, b) => a.index - b.index);
  fn.params = fn.params.map(({ name, type }) => ({ name, type }));
}

let totalCallEdges = 0;
const seenEdges = new Set();

for (const row of callRows) {
  const edgeKey = `${row.callerName}->${row.calleeName}`;
  if (seenEdges.has(edgeKey)) continue;
  seenEdges.add(edgeKey);
  totalCallEdges++;

  const caller = functions[row.callerName];
  const callee = functions[row.calleeName];
  if (caller && !caller.callees.includes(row.calleeName)) {
    caller.callees.push(row.calleeName);
  }
  if (callee && !callee.callers.includes(row.callerName)) {
    callee.callers.push(row.callerName);
  }
}

for (const fn of Object.values(functions)) {
  fn.callers.sort();
  fn.callees.sort();
}

for (const system of Object.keys(systems)) {
  systems[system].sort();
}

const manifest = {
  generated: new Date().toISOString(),
  stats: {
    totalFunctions: Object.keys(functions).length,
    totalCallEdges,
    totalSystems: Object.keys(systems).length,
  },
  systems,
  functions,
};

writeFileSync(outputFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outputFile}`);
