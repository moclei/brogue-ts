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

**Important:** QL syntax is `from … where … select` (not `select … from …`).

### Troubleshooting

- If the `codeql` binary is not found, ensure it is in PATH: `which codeql`
- If databases are missing, re-extract using commands in the **Databases** section above
- The server writes temporary query files to `os.tmpdir()` and cleans them up
- To restart: Claude Code restarts the server automatically on next tool use

### Why a custom wrapper instead of JordyZomer/codeql-mcp

JordyZomer's server uses SSE transport (deprecated in Claude Code) and requires
a separate manual server start + Python/uv environment. The custom wrapper is
a single committed file, auto-started as stdio, and has zero external dependencies.

## Full agent instructions

> Phase 4 — CodeQL-first investigation protocol will be documented here.
> Until then, see `.context/WORKFLOW_v3.md` once updated.
