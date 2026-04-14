# CodeQL Integration

## Intent

Set up CodeQL databases and an MCP server so that AI agents can query codebase structure
(callers, callees, data flow, symbol definitions) without reading large files. Reduces
context window bloat during bug investigation and cross-language (C→TS) tracing.

## Goals

- CodeQL CLI installed and verified
- C database built from `src/brogue/` (one-time; C source is static)
- TypeScript database built from `rogue-ts/` with a documented refresh procedure
- A CodeQL MCP server wired to Claude Code's MCP settings and verified working
- A small query library of common patterns for this project
- Protocol doc updated with CodeQL-first investigation instructions for AI agents (today: `.context/PROTOCOL.md`)
- All new infrastructure documented in `codeql/CONTEXT.md`; PROJECT.md updated

## Scope

In:
- CodeQL CLI setup (via Homebrew or direct download)
- C database extraction (build-traced or compile_commands.json)
- TypeScript database extraction (static, no build needed)
- MCP server selection, installation, and configuration
- Common QL query library (find callers, find callees, find definitions)
- Documentation for agents and humans

Out:
- `@ai-context` annotation conventions (discussed; worth doing incrementally later, but not here)
- Embeddings / vector semantic search
- CI/CD automation for database refresh (document manual process only)
- Custom QL query development beyond the common-patterns library
- Any changes to game code (`rogue-ts/src/`)

## Constraints

- C extraction requires build system tracing — may need Makefile investigation
- Databases are large build artifacts → gitignored; only queries and docs committed
- MCP server must work with Claude Code's MCP settings format (`.mcp.json`)

## Prerequisites

- BrogueCE repo on `feat/codeql-integration` branch (create from `feat/port-v2-playtest`)
- C build system (Makefile) must be inspectable on macOS

## Key source locations

- C game logic: `src/brogue/` (~42K lines, static)
- TypeScript port: `rogue-ts/src/` (living project)
- New infrastructure will live in: `codeql/` (to be created)
