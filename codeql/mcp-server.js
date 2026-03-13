#!/usr/bin/env node
'use strict';

/**
 * brogue-codeql-mcp — minimal stdio MCP server for CodeQL queries.
 *
 * Configured in .mcp.json as a project-scoped stdio server:
 *   "command": "node", "args": ["codeql/mcp-server.js"]
 *
 * Tools exposed:
 *   codeql_list_databases  — list databases in codeql/databases/
 *   codeql_run_query_file  — run a committed .ql file against a database
 *   codeql_run_query_text  — run inline QL text against a database
 */

const { execFileSync } = require('child_process');
const { createInterface } = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const DATABASES_DIR = path.join(__dirname, 'databases');

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'codeql_list_databases',
    description:
      'List available CodeQL databases in codeql/databases/. ' +
      'Use this first to confirm which databases are present.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'codeql_run_query_file',
    description:
      'Run a committed CodeQL query (.ql file) against a named database and return ' +
      'decoded text results. Use for queries in codeql/queries/c/ or codeql/queries/ts/.',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name: "brogue-c" (C source) or "rogue-ts" (TypeScript port)',
        },
        query_path: {
          type: 'string',
          description:
            'Path to .ql file relative to repo root, ' +
            'e.g. "codeql/queries/c/find-callers.ql"',
        },
      },
      required: ['database', 'query_path'],
    },
  },
  {
    name: 'codeql_run_query_text',
    description:
      'Run an inline CodeQL query (provided as text) against a named database. ' +
      'The query must be a complete, valid QL file including an import statement. ' +
      'For C/C++ use "import cpp". For TypeScript use "import javascript". ' +
      'Example: "import cpp\\n\\nselect f.getName() from Function f where f.getName() = \\"attack\\""',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name: "brogue-c" or "rogue-ts"',
        },
        query_text: {
          type: 'string',
          description: 'Full QL query text including import statement.',
        },
      },
      required: ['database', 'query_text'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function listDatabases() {
  if (!fs.existsSync(DATABASES_DIR)) {
    return (
      'No codeql/databases/ directory found. ' +
      'Run extraction commands from codeql/CONTEXT.md.'
    );
  }
  const dbs = fs
    .readdirSync(DATABASES_DIR)
    .filter(e => {
      try {
        return fs.statSync(path.join(DATABASES_DIR, e)).isDirectory();
      } catch {
        return false;
      }
    });
  if (!dbs.length) return 'No databases found in codeql/databases/.';
  return `Available databases:\n${dbs.map(d => `  - ${d}`).join('\n')}`;
}

function runCli(args, opts) {
  return execFileSync('codeql', args, {
    encoding: 'utf8',
    timeout: 120_000,
    ...opts,
  });
}

function decodeResults(bqrsPath) {
  return runCli(['bqrs', 'decode', '--format=text', bqrsPath], { timeout: 30_000 });
}

function runQueryFile(database, queryPath) {
  const dbPath = path.join(DATABASES_DIR, database);
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database "${database}" not found. ` +
      'Run extraction from codeql/CONTEXT.md, or use codeql_list_databases to see what is available.'
    );
  }

  const absQuery = path.resolve(REPO_ROOT, queryPath);
  if (!fs.existsSync(absQuery)) {
    throw new Error(`Query file not found: ${queryPath}`);
  }

  const bqrsPath = path.join(os.tmpdir(), `codeql-${Date.now()}.bqrs`);
  try {
    runCli(['query', 'run', `--database=${dbPath}`, `--output=${bqrsPath}`, absQuery], {
      cwd: REPO_ROOT,
    });
    return decodeResults(bqrsPath);
  } finally {
    try { fs.unlinkSync(bqrsPath); } catch { /* ignore */ }
  }
}

function runQueryText(database, queryText) {
  const dbPath = path.join(DATABASES_DIR, database);
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database "${database}" not found. ` +
      'Run extraction from codeql/CONTEXT.md, or use codeql_list_databases to see what is available.'
    );
  }

  // Infer language from database name or query import statement
  const isTS =
    database.includes('ts') ||
    database.includes('javascript') ||
    queryText.includes('import javascript');
  const packDep = isTS
    ? '  codeql/javascript-all: "*"'
    : '  codeql/cpp-all: "*"';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeql-tmp-'));
  const qlpackPath = path.join(tmpDir, 'qlpack.yml');
  const queryPath = path.join(tmpDir, 'query.ql');
  const bqrsPath = path.join(tmpDir, 'result.bqrs');

  try {
    fs.writeFileSync(
      qlpackPath,
      `name: brogue-inline-query\nversion: 0.0.1\ndependencies:\n${packDep}\n`
    );
    fs.writeFileSync(queryPath, queryText);

    // Install pack dependencies (fast — packs are already cached in ~/.codeql/packages)
    runCli(['pack', 'install', tmpDir], { timeout: 60_000 });

    runCli(['query', 'run', `--database=${dbPath}`, `--output=${bqrsPath}`, queryPath], {
      cwd: REPO_ROOT,
    });
    return decodeResults(bqrsPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function callTool(name, args) {
  switch (name) {
    case 'codeql_list_databases':
      return listDatabases();
    case 'codeql_run_query_file':
      return runQueryFile(args.database, args.query_path);
    case 'codeql_run_query_text':
      return runQueryText(args.database, args.query_text);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC stdio transport
// ---------------------------------------------------------------------------

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return; // ignore malformed input
  }

  const { id, method, params } = msg;

  // Notifications have no id — do not respond
  if (id === undefined || id === null) return;

  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'brogue-codeql-mcp', version: '1.0.0' },
        },
      });
      break;

    case 'tools/list':
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      try {
        const text = callTool(toolName, toolArgs);
        send({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
        });
      } catch (e) {
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${e.message}` }],
            isError: true,
          },
        });
      }
      break;
    }

    default:
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
}

// Sanity check at startup — log to stderr so it doesn't pollute stdout
try {
  execFileSync('codeql', ['--version'], { encoding: 'utf8', timeout: 10_000 });
} catch {
  process.stderr.write('[brogue-codeql-mcp] WARNING: codeql not found in PATH\n');
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', line => {
  const trimmed = line.trim();
  if (trimmed) handleMessage(trimmed);
});
