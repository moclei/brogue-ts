# CodeQL Query Library

Common QL queries for navigating BrogueCE source and the TypeScript port.

## Structure

- `c/` — queries against `codeql/databases/brogue-c` (C game logic, `import cpp`)
- `ts/` — queries against `codeql/databases/rogue-ts` (TypeScript port, `import javascript`)

Each subdirectory is a separate QL pack with its own dependencies.

## Query reference

| File | Database | Description |
|------|----------|-------------|
| `c/find-definition.ql` | brogue-c | Definition location of a named C function |
| `c/find-callers.ql` | brogue-c | All call sites of a named C function |
| `c/find-callees.ql` | brogue-c | All functions called by a named C function |
| `ts/find-definition.ql` | rogue-ts | Definition location of a named TS function |
| `ts/find-callers.ql` | rogue-ts | All call sites of a named TS function |
| `ts/find-callees.ql` | rogue-ts | All functions called by a named TS function |

## Running a query via CLI

```bash
# C query (from repo root)
codeql query run \
  --database=codeql/databases/brogue-c \
  codeql/queries/c/find-callers.ql

# TypeScript query
codeql query run \
  --database=codeql/databases/rogue-ts \
  codeql/queries/ts/find-callers.ql
```

The function name is set via the `funcName()` predicate at the top of each file.
Edit it before running, or use `codeql_run_query_text` via MCP and substitute inline.

## Running via MCP (Claude Code)

Use the `codeql_run_query_file` tool with a specific function name substituted inline:

```
codeql_run_query_file:
  database: brogue-c
  queryFile: codeql/queries/c/find-callers.ql
```

Or use `codeql_run_query_text` to run a query with the function name hard-coded:

```ql
import cpp

from FunctionCall call
where call.getTarget().getName() = "applyDamageToCreature"
select call.getEnclosingFunction().getName(),
       call.getFile().getRelativePath(),
       call.getLocation().getStartLine()
```
