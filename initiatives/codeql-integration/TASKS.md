# TASKS: codeql-integration

Each phase is one session's work. Stop at ~60% context window. Commit + handoff before stopping.

Branch: `feat/codeql-integration` (create from `feat/port-v2-playtest`)
Starting state: no CodeQL infrastructure in the repo

---

## Phase 1: CLI + C database ✓ COMPLETE

### 1a: Install CodeQL CLI
- [x] Install: `brew install codeql` — CodeQL 2.24.3 installed
- [x] Verify: `codeql --version` — confirmed
- [x] Confirm language packs: `codeql resolve languages` — cpp and javascript both present

### 1b: Investigate C build system
- [x] Read `Makefile` — build uses GRAPHICS=YES (SDL2) by default
- [x] Determine headless path: `make GRAPHICS=NO TERMINAL=NO SYSTEM=LINUXLIKE -B`
      works without SDL2/ncurses (null platform only)
- [x] No fallback needed — build trace succeeded

### 1c: Extract C database
- [x] `codeql database create codeql/databases/brogue-c --language=cpp --command="make GRAPHICS=NO TERMINAL=NO SYSTEM=LINUXLIKE -B" --source-root=.`
- [x] Database created successfully

### 1d: Verify C database
- [x] Query for `attack()` → found at `src/brogue/Combat.c:1017` ✓
      (Note: `attackMonster` doesn't exist in C source; `attack` is the correct name)
- [x] Query packs installed: `codeql/cpp-all@8.0.0`, `codeql/javascript-all@2.6.23`
      (stored in `~/.codeql/packages`)

### 1e: Create folder structure + initial docs
- [x] `codeql/queries/c/` and `codeql/queries/ts/` created (separate packs per language)
- [x] `codeql/queries/README.md` written
- [x] `codeql/databases/` added to `.gitignore`
- [x] `codeql/CONTEXT.md` written (skeleton — full content in Phase 4)
- [x] `PROJECT.md` updated with `codeql/` entry

### Phase 1 close
- [x] `git add` relevant files (databases/ excluded via .gitignore)
- [x] `git commit -m "feat: codeql Phase 1 — CLI installed, C database extracted"`
- [x] TASKS.md updated

---

## Phase 2: TypeScript database

### 2a: Extract TypeScript database
- [ ] Run: `codeql database create codeql/databases/rogue-ts --language=javascript-typescript --source-root=rogue-ts/`
- [ ] Confirm database created: `codeql/databases/rogue-ts/` exists

### 2b: Verify TypeScript database
- [ ] Run a test query: find all functions named `attackMonster` in the TS source
- [ ] Confirm result: correct file + line in `rogue-ts/src/`

### 2c: Document refresh procedure
- [ ] Add to `codeql/CONTEXT.md`:
      - Extraction command for TS (for future refreshes)
      - Note that C database is one-time only and never needs refreshing
      - Note that TS database should be refreshed after significant refactors

### Phase 2 close
- [ ] `git commit -m "feat: codeql Phase 2 — TypeScript database extracted"`
- [ ] Update TASKS.md
- [ ] Generate handoff prompt:
  ```
  Continue codeql-integration. Read: .context/PROJECT.md, initiatives/codeql-integration/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 3 — MCP server setup
  Branch: feat/codeql-integration
  Last commit: [hash]
  ```

---

## Phase 3: MCP server setup

### 3a: Research MCP server options
- [ ] Read the README for `JordyZomer/codeql-mcp` — note: supported databases, query interface,
      installation requirements (does it need the full CodeQL bundle or just CLI?)
- [ ] Search for other CodeQL MCP servers (npm, GitHub search)
- [ ] Pick the best option; document choice and reasoning in PLAN.md

### 3b: Install and configure chosen MCP server
- [ ] Follow installation instructions for chosen server
- [ ] Create `.mcp.json` in repo root (or update existing) with server config
- [ ] Point server at both `codeql/databases/brogue-c` and `codeql/databases/rogue-ts`
      (if server supports multiple databases; otherwise document the limitation)

### 3c: Verify through Claude Code
- [ ] In a fresh Claude Code session: ask it to find all callers of `attackMonster` in C
- [ ] Confirm: structured results returned as MCP tool output (not file reads)
- [ ] Test a TS query: find definition of `attackMonster` in TypeScript
- [ ] Document any limitations found in PLAN.md

### 3d: Update CONTEXT.md
- [ ] Add MCP server setup section to `codeql/CONTEXT.md`:
      - Which server is installed and why
      - How to install/configure it (enough to reproduce from scratch)
      - How to restart the server if it stops responding
      - `.mcp.json` snippet example

### Phase 3 close
- [ ] `git commit -m "feat: codeql Phase 3 — MCP server configured"`
- [ ] Update TASKS.md
- [ ] Generate handoff prompt:
  ```
  Continue codeql-integration. Read: .context/PROJECT.md, initiatives/codeql-integration/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 4 — Query library + documentation
  Branch: feat/codeql-integration
  Last commit: [hash]
  ```

---

## Phase 4: Query library + documentation

### 4a: Write common C queries
- [ ] `codeql/queries/c-find-callers.ql` — all call sites of a named C function
- [ ] `codeql/queries/c-find-callees.ql` — all functions called by a named C function
- [ ] `codeql/queries/c-find-definition.ql` — definition location of a named C function
- [ ] Test each against `codeql/databases/brogue-c`; verify correct results for known functions
      (e.g. `attackMonster`, `applyDamageToCreature`)

### 4b: Write common TypeScript queries
- [ ] `codeql/queries/ts-find-callers.ql`
- [ ] `codeql/queries/ts-find-callees.ql`
- [ ] `codeql/queries/ts-find-definition.ql`
- [ ] Test each against `codeql/databases/rogue-ts`; verify correct results

### 4c: Write `codeql/queries/README.md`
- [ ] One-line description of each query
- [ ] How to run a query manually via CLI
- [ ] How the MCP server invokes them (or exposes equivalent tools)

### 4d: Complete `codeql/CONTEXT.md`
- [ ] What CodeQL is and why it's here (2-3 sentences)
- [ ] Folder structure explanation
- [ ] How to run queries manually (CLI commands)
- [ ] How to use queries through Claude Code's MCP tools
- [ ] TS database refresh procedure
- [ ] Cross-language tracing note: C→TS via `// C: FunctionName()` grep
- [ ] When NOT to use CodeQL (single-file reads, small targeted searches are fine)

### 4e: Update `.context/WORKFLOW_v3.md`
- [ ] Add "CodeQL-first investigation protocol" section:
      Before reading any file during bug investigation, query CodeQL first to identify
      the specific functions needed. Read only those — not entire files.
      Include: query → review results → targeted read workflow

### 4f: Final checks
- [ ] `PROJECT.md` entry for `codeql/` is accurate
- [ ] `codeql/CONTEXT.md` has everything a new session needs to get started
- [ ] No `codeql/databases/` content is staged (gitignored)

### Phase 4 close
- [ ] `git commit -m "feat: codeql Phase 4 — query library and documentation complete"`
- [ ] Update TASKS.md — mark all phases complete
- [ ] Update PROJECT.md active initiative (to `port-v2-persistence` or next item)
- [ ] Final summary:
  ```
  codeql-integration complete.
  Databases: codeql/databases/ (gitignored — re-extract if missing; see CONTEXT.md)
  Queries: codeql/queries/
  MCP: configured in .mcp.json
  Agent instructions: .context/WORKFLOW_v3.md — CodeQL-first protocol
  ```
