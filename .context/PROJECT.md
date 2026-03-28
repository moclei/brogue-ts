# BrogueCE TypeScript Port

> **Workflow:** See [WORKFLOW.md](./WORKFLOW.md) for initiative conventions and AI agent instructions.

## Purpose

A TypeScript port of [Brogue: Community Edition](https://github.com/tmewett/BrogueCE) (v1.15.1). The goal is a faithful, idiomatic TypeScript implementation that runs in any JavaScript environment — primarily the browser. The C source in `src/brogue/` is the ground truth for game behavior.

**Owner:** Marc Ó Cleirigh | **License:** AGPL-3.0

---

## Active Work

Port V2 is underway. Full plan: `docs/PORT_V2.md`.

**Start here each session:**
1. Read the active initiative's `BRIEF.md`, `PLAN.md`, `TASKS.md` — these are your full context
2. Find the first unchecked task in `TASKS.md` — that is the session's goal
3. Follow the session protocol described in `PLAN.md` exactly
4. Work on one phase at a time; stop and commit when the phase is done

**Current active initiative:** `port-v2-persistence`

**Why this initiative:** All domain functions are wired, all stubs are classified, and a full
browser playtest was completed. The remaining work is the persistence layer: save/load
(.broguesave), recordings (.broguerec), playback, and file browser UI.

**Previous initiatives (all complete):**
- `port-v2-audit` — all gap files in `docs/audit/`, all stubs tracked
- `port-v2-fix-rendering` — rendering, crash fix, item system, monster AI, power tables (Phases 1–5a)
- `port-v2-domain-gaps` — all 72 MISSING core domain functions implemented
- `port-v2-platform` — browser platform, IO, menus, entry point (Phases 1–6)
- `port-v2-verify-mechanics` — NEEDS-VERIFICATION review, targeting UI, charmRechargeDelay fix
- `port-v2-playtest` — wiring, stub classification, browser playtest (87 files, 2220 pass, 86 skip)
- `port-v2-close-out` — threw/call wired, async cascade, stub audit, Light.c verification, playtest bugs B1–B15 filed. Phases 1–6 complete. Phase 7 (backlog clearance) ongoing via `docs/BACKLOG.md` (88 files, 2242 pass, 82 skip)

First attempt (reference only, do not modify): `ts/`

---

## Session Protocol

**During a session:** check off tasks in `TASKS.md` as completed. Update `PLAN.md` if the approach changes.

**When ending a session** — whether you finished a phase or the session is getting long:
1. Commit completed work to git
2. Update `TASKS.md` to reflect what is and isn't done
3. Update `PLAN.md` if any decisions changed
4. **Stop.** Do not continue into a new phase if context is long.

The initiative docs are the handoff between sessions — not the chat history. A fresh session that reads the three docs picks up exactly where the last one left off. Context compression is not an acceptable substitute for clean docs.

---

## Hard Rules (Port V2)

- **600 lines maximum per file.** If a file is approaching this, split it before continuing. Hard constraint, not a guideline.
- **No stub without a `test.skip`.** Incomplete implementations must have a corresponding failing test describing the correct behavior. Stubs are tracked via the test runner.
- **Async bridge:** any function that waits for player input must be `async` and use `await waitForEvent()`. Synchronous event queue polling is never a substitute for async waiting.

---

## Repository Layout

```
src/brogue/          C source — ground truth for game behavior
src/platform/        C platform backends (SDL2, curses, web, null)
ts/                  First port attempt — preserved for reference, do not modify
rogue-ts/            Second port attempt — active work
tools/               Dev tools — sprite assigner, sheet generators (see tools/CONTEXT.md)
initiatives/         Active initiative docs (BRIEF / PLAN / TASKS)
initiatives/archive/ Old initiatives from first attempt
docs/                Reference: PORT_V2.md, FIRST_PORT_ANALYSIS.md
.context/            PROJECT.md (this file), WORKFLOW.md
codeql/              CodeQL databases + query library (see codeql/CONTEXT.md); databases/ gitignored
```

## Context Hierarchy

This file is the root context document — it provides orientation and references
to deeper context. Key subdirectories have their own `CONTEXT.md` files that
cover domain-specific details. Load them on demand, not by default.

| Path | Scope |
|---|---|
| `.context/PROJECT.md` | This file — project overview, layout, conventions |
| `docs/CONTEXT.md` | Feature docs, audits, investigations — see its own CONTEXT.md for full listing |
| `tools/CONTEXT.md` | Listing of all dev tools (sprite assigner, generators, build scripts) |
| `tools/sprite-assigner-v2/CONTEXT.md` | Full architecture and feature docs for the sprite assigner |
| `tools/dungeon-cake/CONTEXT.md` | Dungeon Cake — standalone sprite evaluation tool with debug controls |
| `codeql/CONTEXT.md` | CodeQL databases, query reference, shell workflow |
| `.context/research/INDEX.md` | Pre-computed mechanic/system research — load before investigating |

When working in a subdirectory, read its `CONTEXT.md` first. When adding a new
tool or subsystem, add a `CONTEXT.md` if it would save a future reader from
having to piece together understanding from source files alone.

---

## C Architecture (Reference)

The C codebase is ~49K lines, split across three layers:

**Game Logic** (`src/brogue/` ~42K lines) — all dungeon generation, combat, items, monsters, movement, lighting, UI. Key files: `Items.c` (8K), `IO.c` (5K), `Monsters.c` (4.8K), `Architect.c` (3.8K), `Rogue.h` (types/constants), `Time.c`, `Movement.c`, `Combat.c`.

**Platform** (`src/platform/`) — the `brogueConsole` interface: draw a glyph, receive an event, pause for milliseconds. Five backends: SDL2, curses, web (IPC), null. The TypeScript port replaces these with a browser canvas backend.

**Rendering model:** 100×34 character grid (79×29 dungeon viewport + 20-column sidebar + 3-row message area). Each cell: Unicode glyph + foreground RGB + background RGB (0-100 scale).

**Key C patterns and their TypeScript equivalents:**

| C | TypeScript |
|---|-----------|
| `rogue` global struct | Shared state in `core.ts`, closed over by context builders |
| Linked lists (`nextCreature`) | Arrays (`Creature[]`) with deferred cleanup via `removeDeadMonsters()` |
| `fixpt` (64-bit fixed-point) | `number` (53-bit mantissa, validated safe for Brogue's range) |
| `Fl(N)` bitfield flags | `number` with bitwise ops, flag enums in `types/flags.ts` |
| Blocking `getEvent()` | `async/await` with `waitForEvent()` |

---

## Code Investigation Tools

**Priority order** when investigating code:

1. **Check `.context/research/INDEX.md`** — if a research doc exists for the topic, read
   it and skip everything below. This is pre-computed understanding.
2. **CodeQL** — for call chains, field access tracing, type usage, function listings.
   Available via MCP tools (`codeql_run_query_text`) or shell (`codeql/run-query.sh`).
   Full instructions: `codeql/CONTEXT.md`. Query syntax: `codeql/QUERY_REFERENCE.md`.
3. **Grep** — for string patterns, comment searches, cross-language `// C: FuncName()` lookups.
4. **Glob** — for finding files by name.
5. **Read** — for reading specific lines of a file already located by steps 1–4.

**Goal:** identify exact file + line targets before reading code. Never read an entire
large file hoping to find the relevant function.

---

## Principles

1. **Fidelity first.** The port should produce gameplay indistinguishable from the C version.
2. **Platform-agnostic core.** Game logic has zero rendering or I/O dependencies.
3. **Port, don't redesign.** No "improvements" to game logic during porting.
4. **Readable TypeScript.** Idiomatic TS, not transliterated C — but keep the mapping to C traceable.

---

*Update this file when project scope, architecture, or key decisions change materially.*
