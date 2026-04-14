# CodeQL Context

## What is this?

CodeQL builds queryable databases from source code. Instead of grepping and reading
large files to trace call chains, you query the database: "who calls X?", "what does
X call?", "where is struct field Y accessed?". Queries run in 10–30 seconds and return
structured file + line results. Two databases are maintained: one for the C game logic,
one for the TypeScript port.

**When to use CodeQL:**
- Tracing callers / callees across multiple files
- Finding all accesses to a struct field or property
- Finding all functions that operate on a specific type
- Listing all functions in a file to get an overview
- Any question that would require reading 3+ files to answer with grep

**When NOT to use CodeQL:**
- Reading a single known file → use Read
- Searching for a string pattern → use Grep
- Finding a file by name → use Glob
- Quick one-off lookups → use Grep with `// C: FunctionName()` comments

## Folder structure

```
codeql/
├── CONTEXT.md              # This file
├── QUERY_REFERENCE.md      # QL syntax cheat sheet (read before writing inline queries)
├── run-query.sh            # Shell wrapper for inline queries (see below)
├── mcp-server.js           # Stdio MCP server (auto-started by Cursor/Claude Code)
├── databases/              # gitignored — re-extract if missing
│   ├── brogue-c/           # C database — extracted once, static source
│   └── rogue-ts/           # TS database — refresh after significant refactors
└── queries/
    ├── c/                  # Committed C query files
    └── ts/                 # Committed TypeScript query files
```

## Databases

### C database (`brogue-c`)

Built from `src/brogue/`. The C source is static — extract once.

```bash
codeql database create codeql/databases/brogue-c \
  --language=cpp \
  --command="make GRAPHICS=NO TERMINAL=NO SYSTEM=LINUXLIKE -B" \
  --source-root=. \
  --overwrite
```

### TypeScript database (`rogue-ts`)

Built from `rogue-ts/`. Refresh after significant refactors (takes ~30–60s).

```bash
codeql database create codeql/databases/rogue-ts \
  --language=javascript-typescript \
  --source-root=rogue-ts/ \
  --overwrite
```

## How to run queries

### Method 1: MCP tools (preferred in Cursor and Claude Code)

The MCP server is configured in both `.cursor/mcp.json` (Cursor) and `.mcp.json`
(Claude Code). It exposes three tools:

| Tool | Use |
|------|-----|
| `codeql_list_databases` | Confirm which databases exist |
| `codeql_run_query_file` | Run a committed `.ql` file by path |
| `codeql_run_query_text` | Run inline QL text (most powerful — compose queries on the fly) |

For `codeql_run_query_text`, provide a complete QL file including the import:

```ql
import cpp

from Function f
where f.getName() = "attack" and f.hasDefinition()
select f.getFile().getRelativePath(), f.getLocation().getStartLine(), f.getName()
```

For TypeScript queries, use `import javascript` instead of `import cpp`.

### Method 2: Shell wrapper (fallback)

If MCP is unavailable, use `codeql/run-query.sh` from the repo root:

```bash
codeql/run-query.sh brogue-c 'import cpp
from Function f
where f.getName() = "allocGrid" and f.hasDefinition()
select f.getFile().getRelativePath(), f.getLocation().getStartLine(), f.getName()'
```

This handles temp files, qlpack creation, and BQRS decoding in one command.

### Method 3: Direct CLI (for committed query files)

```bash
codeql query run \
  --database=codeql/databases/brogue-c \
  codeql/queries/c/find-callers.ql
```

Note: direct CLI outputs to a `.bqrs` file which needs a separate decode step.
The MCP server and shell wrapper handle this automatically.

## Committed query files

### C queries (`codeql/queries/c/`)

| File | Purpose | Default target |
|------|---------|---------------|
| `find-definition.ql` | Find where a C function is defined | `attack` |
| `find-callers.ql` | Find all call sites of a C function | `attack` |
| `find-callees.ql` | Find all functions called by a C function | `attack` |
| `find-functions-in-file.ql` | List all functions defined in a file | `%Grid.c` |
| `find-global-access.ql` | Find all functions accessing a global variable | `pmap` |
| `find-field-access.ql` | Find all accesses to a struct field | `layers` |
| `find-functions-with-param-type.ql` | Find functions taking a parameter of a type | `creature` |

### TypeScript queries (`codeql/queries/ts/`)

| File | Purpose | Default target |
|------|---------|---------------|
| `find-definition.ql` | Find where a TS function is defined | `buildCombatAttackContext` |
| `find-callers.ql` | Find all call sites of a TS function | `buildCombatAttackContext` |
| `find-callees.ql` | Find all functions called by a TS function | `buildCombatAttackContext` |
| `find-functions-in-file.ql` | List all functions defined in a file | `%grid.ts` |
| `find-property-access.ql` | Find all accesses to a property name | `layers` |
| `find-type-references.ql` | Find all references to a type/interface | `Creature` |
| `find-ts-stubs.ql` | Find stub arrow functions (port completeness) | all src/ |

**Important:** The committed query files have hardcoded default targets (like `attack`
or `%Grid.c`). For ad-hoc queries, use `codeql_run_query_text` or the shell wrapper
with inline QL — this lets you target any function, field, or file without editing
query files.

## Agent investigation protocol

Use this decision tree when investigating code:

```
Need to understand a system or trace a bug?
│
├── Research doc exists in docs/research/?
│   └── YES → Read it. Done. Skip CodeQL/grep entirely.
│
├── Need to know what functions a file contains?
│   └── Use find-functions-in-file (CodeQL or inline)
│
├── Need to trace who calls a function?
│   └── Use find-callers (CodeQL)
│
├── Need to trace what a function depends on?
│   └── Use find-callees (CodeQL)
│
├── Need to find all code touching a data structure field?
│   └── Use find-field-access / find-property-access (CodeQL)
│
├── Need to find all code using a global (pmap, tmap, etc.)?
│   └── Use find-global-access (CodeQL)
│
├── Need to find a string pattern or comment?
│   └── Use Grep
│
├── Need to find a file by name?
│   └── Use Glob
│
└── Need to read specific code you've already located?
    └── Use Read with line ranges
```

The goal: **identify exact file + line targets via CodeQL, then read only those
lines**. Never read an entire 5000-line file hoping to find the relevant function.

## Inline query cookbook

These are copy-paste-and-modify patterns for `codeql_run_query_text` or the shell
wrapper. Read `QUERY_REFERENCE.md` for full syntax rules.

### Find all functions that read/write a global

```ql
import cpp
from VariableAccess va, GlobalVariable gv
where gv.getName() = "pmap"
  and va.getTarget() = gv
select va.getEnclosingFunction().getName() as func,
       va.getFile().getRelativePath() as file,
       va.getLocation().getStartLine() as line
order by file, line
```

### Find all accesses to a struct field

```ql
import cpp
from FieldAccess fa
where fa.getTarget().getName() = "layers"
select fa.getEnclosingFunction().getName() as func,
       fa.getFile().getRelativePath() as file,
       fa.getLocation().getStartLine() as line,
       fa.getTarget().getDeclaringType().getName() as structName
order by file, line
```

### Find all functions taking a creature* parameter

```ql
import cpp
from Function f, Parameter p
where f.hasDefinition()
  and p = f.getAParameter()
  and p.getType().getUnspecifiedType().(PointerType).getBaseType().getName() = "creature"
select f.getName() as func,
       f.getFile().getRelativePath() as file,
       f.getLocation().getStartLine() as line,
       p.getName() as param
order by file, line
```

### Find all TS property accesses

```ql
import javascript
from DotExpr dot
where dot.getPropertyName() = "layers"
  and dot.getFile().getRelativePath().matches("src/%")
select dot.getEnclosingFunction().getName() as func,
       dot.getFile().getRelativePath() as file,
       dot.getLocation().getStartLine() as line
order by file, line
```

### Find all TS type/interface references

```ql
import javascript
from TypeAccess ta
where ta.getTypeName().(LocalTypeName).getName() = "Creature"
  and ta.getFile().getRelativePath().matches("src/%")
select ta.getFile().getRelativePath() as file,
       ta.getLocation().getStartLine() as line
order by file, line
```

## Cross-language tracing (C → TypeScript)

To find the TypeScript equivalent of a C function, grep for the C function name
as a reference comment. Convention: ports include `// C: FunctionName()`.

```bash
rg "// C: attack" rogue-ts/src/
```

This is faster than CodeQL for one-off cross-language lookups.

## Troubleshooting

- **`codeql` not found:** ensure it is in PATH: `which codeql`
- **Databases missing:** re-extract using commands in the Databases section
- **MCP server not loading in Cursor:** restart Cursor after adding `.cursor/mcp.json`
- **Query returns no results:** check `import cpp` vs `import javascript` — wrong import silently returns empty
- **Pack install slow on first run:** pack dependencies cache to `~/.codeql/packages` after first install
