# CodeQL Context

## What is this?

CodeQL is a static analysis tool that builds queryable databases from source code.
This project uses it so AI agents can answer "who calls X?" or "where is X defined?"
without reading large files. Two databases are maintained: one for the C game logic,
one for the TypeScript port.

## Folder structure

```
codeql/
├── CONTEXT.md          # This file
├── databases/          # gitignored — re-extract if missing (see below)
│   ├── brogue-c/       # C database — extracted once, never refreshed
│   └── rogue-ts/       # TS database — refresh after significant refactors
└── queries/
    ├── c/              # C queries (brogue-queries-c pack, depends on codeql/cpp-all)
    │   └── qlpack.yml
    └── ts/             # TS queries (brogue-queries-ts pack, depends on codeql/javascript-all)
        └── qlpack.yml
```

## Databases

### C database (`codeql/databases/brogue-c`)

Built from `src/brogue/` using the null platform backend (no SDL2 or ncurses required).
Extraction command (run from repo root):

```bash
codeql database create codeql/databases/brogue-c \
  --language=cpp \
  --command="make GRAPHICS=NO TERMINAL=NO SYSTEM=LINUXLIKE -B" \
  --source-root=. \
  --overwrite
```

The C source is static — this only needs to be done once (or after a C source update).

### TypeScript database (`codeql/databases/rogue-ts`)

Built from `rogue-ts/` using static extraction (no build needed — TypeScript is analyzed directly).
Extraction command (run from repo root):

```bash
codeql database create codeql/databases/rogue-ts \
  --language=javascript-typescript \
  --source-root=rogue-ts/ \
  --overwrite
```

Refresh this database after significant refactors or after adding new source files. Takes ~30–60 seconds.
The C database does **not** need refreshing — C source is static.

Verified: `buildCombatAttackContext` found at `combat.ts:192`. ✓

## Query packs

Each subdirectory under `queries/` is a QL pack. Before running queries, install
pack dependencies (one-time, installs to `~/.codeql/packages`):

```bash
codeql pack install codeql/queries/c/
codeql pack install codeql/queries/ts/
```

## Running queries

```bash
codeql query run \
  --database=codeql/databases/brogue-c \
  codeql/queries/c/<query-name>.ql
```

## MCP server

The project includes a minimal stdio MCP server (`codeql/mcp-server.js`) configured
in `.mcp.json` at the repo root. Claude Code auto-starts it as a child process — no
manual server launch needed.

### Configuration (`.mcp.json`)

```json
{
  "mcpServers": {
    "codeql": {
      "command": "node",
      "args": ["codeql/mcp-server.js"]
    }
  }
}
```

### Tools exposed

| Tool | Description |
|------|-------------|
| `codeql_list_databases` | List available databases in `codeql/databases/` |
| `codeql_run_query_file` | Run a committed `.ql` file by path (relative to repo root) |
| `codeql_run_query_text` | Run inline QL text against a database |

### Running inline queries

For `codeql_run_query_text`, provide a complete QL file including the import:

```ql
import cpp

from Function f
where f.getName() = "attack"
select f.getName(), f.getFile().getBaseName(), f.getLocation().getStartLine()
```

For TypeScript queries use `import javascript` instead of `import cpp`.

**Important:** QL syntax is `from … where … select` (not `select … from …`). See `codeql/QUERY_REFERENCE.md` for syntax rules, predicate tables, and worked examples before writing any query.

### Troubleshooting

- If the `codeql` binary is not found, ensure it is in PATH: `which codeql`
- If databases are missing, re-extract using commands in the **Databases** section above
- The server writes temporary query files to `os.tmpdir()` and cleans them up
- To restart: Claude Code restarts the server automatically on next tool use

### Why a custom wrapper instead of JordyZomer/codeql-mcp

JordyZomer's server uses SSE transport (deprecated in Claude Code) and requires
a separate manual server start + Python/uv environment. The custom wrapper is
a single committed file, auto-started as stdio, and has zero external dependencies.

## Cross-language tracing (C → TypeScript)

To find the TypeScript equivalent of a C function, grep `rogue-ts/src/` for the C function
name as a comment. Convention in this project: ports include a `// C: FunctionName()`
reference comment. This is faster than CodeQL for one-off lookups:

```bash
grep -r "// C: attack" rogue-ts/src/
```

## When NOT to use CodeQL

CodeQL is best for traversal questions (callers, callees, data flow). Skip it for:

- Reading a single known file — use Read directly
- Searching for a string pattern — use Grep
- Finding a file by name — use Glob

Use CodeQL when you would otherwise need to read multiple large files to trace a call chain.

## Agent investigation protocol

Before reading any file during bug investigation:

1. **Find definition** — run `find-definition.ql` (or `codeql_run_query_text`) to confirm
   which file and line the function lives in. Do not assume from the file name.
2. **Get callers** — run `find-callers.ql` to see all call sites. This scopes the blast
   radius before reading anything.
3. **Get callees** — run `find-callees.ql` to understand what the function depends on.
4. **Read targeted** — read only the specific functions identified above, not entire files.

This sequence replaces the habit of opening `IO.c` or `lifecycle.ts` top-to-bottom.
The queries run in 200–800 ms and return structured file + line results.
