#!/usr/bin/env npx tsx
/**
 * TS Stub Scanner — finds stub arrow functions in context-builder objects.
 *
 * Uses the TypeScript compiler API (parse-only, no type checking) to detect
 * property assignments where the value is an arrow function returning a
 * trivial constant: () => {}, () => false, () => 0, () => null, etc.
 *
 * Usage: npx tsx tools/analysis/scan-stubs.ts [--out <path>]
 *        Default output: docs/analysis/stub-report.json
 */

import * as ts from 'typescript';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TS_SRC = join(REPO_ROOT, 'rogue-ts/src');
const DEFAULT_OUT = join(REPO_ROOT, 'docs/analysis/stub-report.json');

interface StubEntry {
  file: string;
  line: number;
  property: string;
  stubType: string;
  contextBuilder: string;
}

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function classifyStub(arrow: ts.ArrowFunction): string | null {
  const { body } = arrow;

  if (ts.isBlock(body)) {
    if (body.statements.length === 0) return '() => {}';
    return null;
  }

  if (body.kind === ts.SyntaxKind.FalseKeyword) return '() => false';
  if (body.kind === ts.SyntaxKind.TrueKeyword) return '() => true';
  if (body.kind === ts.SyntaxKind.NullKeyword) return '() => null';

  if (ts.isNumericLiteral(body) && body.text === '0') return '() => 0';
  if (ts.isNumericLiteral(body) && body.text === '-1') return '() => -1';

  if (ts.isPrefixUnaryExpression(body)
    && body.operator === ts.SyntaxKind.MinusToken
    && ts.isNumericLiteral(body.operand)
    && body.operand.text === '1') return '() => -1';

  if (ts.isArrayLiteralExpression(body) && body.elements.length === 0) return '() => []';

  if (ts.isStringLiteral(body) && body.text === '') return '() => ""';

  return null;
}

function getEnclosingFunctionName(node: ts.Node, sourceFile: ts.SourceFile): string {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (ts.isFunctionExpression(current) && current.name) {
      return current.name.text;
    }
    if (ts.isArrowFunction(current)) {
      const parent = current.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      if (current.initializer && (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))) {
        return current.name.text;
      }
    }
    if (ts.isMethodDeclaration(current) && current.name && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    current = current.parent;
  }
  return '<module>';
}

function scanFile(filePath: string, relBase: string): StubEntry[] {
  const text = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const stubs: StubEntry[] = [];
  const relPath = relative(relBase, filePath);

  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && ts.isArrowFunction(node.initializer)) {
      const stubType = classifyStub(node.initializer);
      if (stubType) {
        const propName = ts.isIdentifier(node.name)
          ? node.name.text
          : ts.isStringLiteral(node.name)
            ? node.name.text
            : node.name.getText(sourceFile);

        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const contextBuilder = getEnclosingFunctionName(node, sourceFile);

        stubs.push({
          file: relPath,
          line,
          property: propName,
          stubType,
          contextBuilder,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return stubs;
}

const outPath = process.argv.includes('--out')
  ? resolve(process.argv[process.argv.indexOf('--out') + 1])
  : DEFAULT_OUT;

const files = collectTsFiles(TS_SRC);
const allStubs: StubEntry[] = [];

for (const file of files) {
  allStubs.push(...scanFile(file, join(REPO_ROOT, 'rogue-ts')));
}

allStubs.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const byType: Record<string, number> = {};
const byFunction: Record<string, { stubCount: number; locations: string[] }> = {};
const byContextBuilder: Record<string, { total: number; stubs: string[] }> = {};

for (const stub of allStubs) {
  byType[stub.stubType] = (byType[stub.stubType] || 0) + 1;

  if (!byFunction[stub.property]) {
    byFunction[stub.property] = { stubCount: 0, locations: [] };
  }
  byFunction[stub.property].stubCount++;
  byFunction[stub.property].locations.push(`${stub.file}:${stub.line}`);

  if (!byContextBuilder[stub.contextBuilder]) {
    byContextBuilder[stub.contextBuilder] = { total: 0, stubs: [] };
  }
  byContextBuilder[stub.contextBuilder].total++;
  if (!byContextBuilder[stub.contextBuilder].stubs.includes(stub.property)) {
    byContextBuilder[stub.contextBuilder].stubs.push(stub.property);
  }
}

const filesWithStubs = new Set(allStubs.map(s => s.file));

const report = {
  scanned: new Date().toISOString(),
  stats: {
    filesScanned: files.length,
    filesWithStubs: filesWithStubs.size,
    totalStubs: allStubs.length,
    uniqueStubNames: Object.keys(byFunction).length,
    contextBuilders: Object.keys(byContextBuilder).length,
    byType,
  },
  stubs: allStubs,
  byFunction,
  byContextBuilder,
};

writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

console.log(`Stub report: ${outPath}`);
console.log(`  Files scanned: ${report.stats.filesScanned}`);
console.log(`  Files with stubs: ${report.stats.filesWithStubs}`);
console.log(`  Total stubs: ${report.stats.totalStubs}`);
console.log(`  Unique stub names: ${report.stats.uniqueStubNames}`);
console.log(`  Context builders: ${report.stats.contextBuilders}`);
console.log(`  By type: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(', ')}`);
