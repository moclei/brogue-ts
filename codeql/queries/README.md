# CodeQL Query Library

Common QL queries for navigating BrogueCE source and the TypeScript port.

> **Phase 4 work item** — queries will be written in Phase 4. This README will be
> updated with a table of all queries, usage examples, and how to invoke them via MCP.

## Structure

- `c/` — queries against `codeql/databases/brogue-c` (C game logic)
- `ts/` — queries against `codeql/databases/rogue-ts` (TypeScript port)

Each subdirectory is a separate QL pack (different languages require separate packs).

## Running a query

```bash
# C query
codeql query run --database=codeql/databases/brogue-c codeql/queries/c/<query>.ql

# TypeScript query
codeql query run --database=codeql/databases/rogue-ts codeql/queries/ts/<query>.ql
```

## Planned queries (Phase 4)

| File | Description |
|------|-------------|
| `c/find-callers.ql` | All call sites of a named C function |
| `c/find-callees.ql` | All functions called by a named C function |
| `c/find-definition.ql` | Definition location of a named C function |
| `ts/find-callers.ql` | All call sites of a named TS function |
| `ts/find-callees.ql` | All functions called by a named TS function |
| `ts/find-definition.ql` | Definition location of a named TS function |
