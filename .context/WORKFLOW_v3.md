# Workflow

**Principle:** Documentation should reduce friction, not create it. Every document must earn its existence.

---

## Structure

```
.context/
├── PROJECT.md          # Project-level context (what, why, where things live)
└── WORKFLOW.md         # This file
initiatives/
└── <initiative-name>/
    ├── BRIEF.md        # Intent, goals, scope — stable
    ├── PLAN.md         # Technical approach, decisions, session notes — semi-stable
    └── TASKS.md        # Execution checklist — living
```

**Three documents per initiative. No more.** If you feel the urge to create a fourth, that's a signal one of the three needs better organisation.

One active initiative at a time where possible. More than two and discipline breaks down.

---

## Documents

### BRIEF.md — The Anchor
Why this initiative exists and what it must achieve. Written at kickoff, rarely updated. Keep under half a page.

```markdown
## Intent
What are we building and why? 1–3 sentences.

## Goals
- What does done look like?

## Scope
In: ...
Out: ...

## Constraints
Dependencies, non-negotiables.
```

"What's out" is as important as "what's in." If you're updating BRIEF.md frequently, scope is unstable — resolve that before continuing.

---

### PLAN.md — The Design
How it's being built. Update when the approach changes, not when tasks complete.

```markdown
## Approach
High-level architecture, key components, how they fit together.

## Technical Notes
Patterns, APIs, data models — organised with subheadings.

## Rejected Approaches
Append-only. One line each. Never cleaned up.

## Open Questions
Unresolved decisions. Should trend toward empty.
```

If PLAN.md exceeds 150 lines, flag it to the user: *"PLAN.md is getting long — consider pruning old Session Notes or splitting this initiative."* Do not fix it unilaterally.

---

### TASKS.md — The Checklist
What to do next. Tasks must be concrete and actionable. Check off on completion. Remove tasks that are no longer relevant.

Use phases if the initiative has natural stages; skip them if not.

```markdown
## Phase 1: <name>
- [x] Completed task
- [ ] Current task

## Deferred
[from: initiative-name] One-line note.
```

`## Deferred` is for out-of-scope discoveries or cross-initiative findings. Never actioned directly — consulted when starting new initiatives.

---

## Lifecycle

**Starting:** Create folder under `initiatives/`. Write BRIEF.md first — clarity on scope before any code. Then PLAN.md, then TASKS.md. Reference in PROJECT.md if significant.

**During:** Update TASKS.md as you work — the task isn't done until TASKS.md reflects it. Update PLAN.md if the approach changes. Update BRIEF.md only if goals shift.

**Completing:** All tasks checked off or removed. Open Questions empty or resolved. Folder stays as history.

**Abandoning:** Add `**Status: Abandoned — <reason>**` to the top of BRIEF.md. Don't delete the folder.

---

## Git

Branch for every design direction or exploratory approach. Name branches `feat/<thing>` or `design/<what-youre-trying>`.

- Always commit before switching branches, even broken work. Use `WIP:` prefix freely.
- Commit at every meaningful checkpoint.
- Abandoned branches stay. They are history.

---

## Session Management

Monitor context and close sessions proactively. Do not wait to be asked.

**When to close:** At ~60% context usage, finish the current atomic task and stop. Do not start the next task.

**Close procedure — every session end:**
1. `git add -A && git commit -m "WIP: <what was done>"` — always, even if broken
2. Update TASKS.md to reflect current state
3. Generate a handoff prompt and present it to the user, ready to copy

**Handoff prompt format — pointers to docs, not content. Under 10 lines.**
```
Continue [project]. Initiative: initiatives/[folder]/
Read on startup: .context/PROJECT.md, BRIEF.md, PLAN.md, TASKS.md
Resume at: [exact task from TASKS.md]
Branch: [branch name]
```

**Session notes:**
- Nothing significant → nothing written, prompt is self-contained
- 1–3 lines → inline in the prompt
- More than 3 lines → append `## Session Notes [date]` to PLAN.md, add one line to prompt: `Notes: see PLAN.md ## Session Notes [date]`

Never create a new file for session notes.

---

## CodeQL-first investigation protocol

Before reading any file during bug investigation or cross-language tracing:

1. **Find definition** — use `codeql_run_query_file` with `c/find-definition.ql` or
   `ts/find-definition.ql` to get the exact file and line. Don't assume from the name.
2. **Get callers** — run `find-callers.ql` to see all call sites.
3. **Get callees** — run `find-callees.ql` to understand dependencies.
4. **Read targeted** — read only the specific functions identified. Not entire files.

Quick reference:

```
# MCP tools available in Claude Code:
codeql_list_databases        → list available databases (brogue-c, rogue-ts)
codeql_run_query_file        → run a committed .ql file
codeql_run_query_text        → run inline QL (substitute function name directly)

# Query files (edit funcName() or substitute inline):
codeql/queries/c/find-definition.ql   → C function definition
codeql/queries/c/find-callers.ql      → C callers
codeql/queries/c/find-callees.ql      → C callees
codeql/queries/ts/find-definition.ql  → TS function definition
codeql/queries/ts/find-callers.ql     → TS callers
codeql/queries/ts/find-callees.ql     → TS callees
```

Full instructions: `codeql/CONTEXT.md`

When NOT to use CodeQL: single-file reads, string pattern searches (use Grep), file
name lookups (use Glob).

---

## AI Agent Instructions

**Starting a session:**
1. Read BRIEF.md, PLAN.md, and TASKS.md.
2. Find the first unchecked task in TASKS.md — that is the session's goal.

**During a session:**
- Check off tasks in TASKS.md as they complete, before moving on.
- Update PLAN.md if the technical approach changes.
- No files beyond BRIEF.md, PLAN.md, TASKS.md. Unsure where something goes? PLAN.md → Open Questions.

**Ending a session:**
1. Commit work to git.
2. Update TASKS.md — current state, not aspirational.
3. Update PLAN.md if decisions changed.
4. Run the close procedure above. Stop.

A fresh session reading the three docs is always preferable to a compressed continuation.
