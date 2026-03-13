# PLAN: codeql-integration

## Session Protocol

Each phase is one session's work. Stop at ~60% context window usage.

Close procedure for every session:
1. `git commit` (even WIP — use `WIP:` prefix if incomplete)
2. Update TASKS.md to reflect current state
3. Generate handoff prompt (format below) and present to user
4. Stop. Do not start the next phase.

Handoff prompt format:
```
Continue codeql-integration. Read: .context/PROJECT.md, initiatives/codeql-integration/BRIEF.md, PLAN.md, TASKS.md
Resume at: [exact phase/task]
Branch: feat/codeql-integration
Last commit: [hash]
[Optional: 1-3 lines if decisions were made this session]
```

---

## Phase 1: CLI + C database

**Goal:** CodeQL CLI installed; C database extracted from `src/brogue/`; verified queryable.

### Approach

Install via Homebrew: `brew install codeql`. Alternatively, download the CodeQL bundle
directly from GitHub releases (includes CLI + all language packs in one archive).

C extraction requires build tracing — CodeQL instruments the compiler while the actual
build runs:
```bash
codeql database create codeql/databases/brogue-c \
  --language=cpp \
  --command="make" \
  --source-root=.
```

If the build system requires SDL2 or other missing libraries, investigate whether a
minimal build target exists that compiles just `src/brogue/` without the platform layer.
The null platform backend (`src/platform/nullplatform.c`) may provide a minimal path.

Fall back option: `--build-mode=none` (indirect extraction — less precise but may
work for navigation queries without needing a successful build).

The C database is extracted once and never refreshed. C source is static.

After extraction, verify with a test query:
```ql
select f.getName() from Function f where f.getName() = "attackMonster"
```

Create `codeql/` folder structure:
```
codeql/
├── CONTEXT.md          # How to use CodeQL in this project (skeleton Phase 1, full Phase 4)
├── databases/          # gitignored — not committed
│   ├── brogue-c/       # C database (one-time extraction)
│   └── rogue-ts/       # TS database (refreshed as needed)
└── queries/            # Committed — common QL query patterns
    └── README.md
```

---

## Phase 2: TypeScript database

**Goal:** TS database extracted from `rogue-ts/`; verified queryable; refresh procedure documented.

### Approach

TypeScript is a first-class CodeQL language — static extraction, no build needed:
```bash
codeql database create codeql/databases/rogue-ts \
  --language=javascript-typescript \
  --source-root=rogue-ts/
```

Refresh procedure (document in CONTEXT.md):
> When significant code is added or refactored, re-run the extraction command from the
> repo root. The old database is replaced in place. Takes ~30–60 seconds.

The C database does NOT need a refresh procedure.

---

## Phase 3: MCP server setup

**Goal:** A CodeQL MCP server configured in Claude Code's MCP settings; basic queries
verified working through Claude Code tool calls.

### Approach

Evaluate available options (in priority order):
1. `JordyZomer/codeql-mcp` — the server the user found; read README carefully
2. Any other CodeQL MCP servers found via search
3. A minimal custom wrapper if no existing server is adequate

Wire the chosen server to Claude Code's project-level MCP settings:
- Project-level: `.mcp.json` in the repo root (preferred — version-controlled)
- User-level: `~/.claude/mcp.json` (fallback if project-level is not appropriate)

Verify by asking Claude Code: "find all callers of attackMonster in C source."
Result should come back as structured data (file paths + line numbers), not file reads.

Document the configuration in `codeql/CONTEXT.md` — enough that a new session or a
new developer can reproduce the setup.

---

## Phase 4: Query library + documentation

**Goal:** Common QL queries written and tested; WORKFLOW.md updated; all docs complete.

### Common queries (`codeql/queries/`)

C queries (run against `brogue-c` database):
- `c-find-callers.ql` — all call sites of a named function
- `c-find-callees.ql` — all functions called by a named function
- `c-find-definition.ql` — definition location of a named function

TypeScript queries (run against `rogue-ts` database):
- `ts-find-callers.ql`
- `ts-find-callees.ql`
- `ts-find-definition.ql`

Each query uses a `string funcName` parameter so it can be invoked with any function name.

### Cross-language tracing note (doc only)

To find the TypeScript equivalent of a C function: grep rogue-ts/src/ for the C function
name as a comment. Convention in this project: ports include a `// C: FunctionName()`
reference comment. This is manual but effective and doesn't require CodeQL.

### WORKFLOW.md update

Add "CodeQL-first investigation protocol" to `.context/WORKFLOW.md`:
> Before reading any file during bug investigation:
> 1. Use CodeQL to find the function definition (find-definition query)
> 2. Use CodeQL to get callers and callees
> 3. Read only the specific targeted functions — not entire files

### Note on @ai-context

Out of scope here. Future consideration: `// @ai-context:` comments at the top of
functions that explain intent, C equivalence, and key concepts. Queryable with a
simple grep. Can be added incrementally without a formal initiative.

---

## Rejected Approaches

- Embeddings/vector search: real infrastructure overhead; out of proportion for project size.
- ctags only: gives definitions but no call graph traversal or data flow.
- CI/CD auto-refresh of TS database: over-engineering at current project velocity.

## Open Questions

- ~~Which MCP server best supports dual-database (C + TS) queries?~~ → Custom Node.js stdio wrapper (Phase 3)
- ~~Can the C build be traced on macOS without SDL2?~~ → Yes, `GRAPHICS=NO TERMINAL=NO SYSTEM=LINUXLIKE` (Phase 1)
