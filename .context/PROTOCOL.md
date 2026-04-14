# Protocol

**Principle:** Documentation reduces friction, not creates it. Every document must earn its existence.

Each session is stateless. Persistence lives in three documents per initiative (BRIEF, PLAN, TASKS). Transitions between sessions happen via Relays — structured prompts that reconstruct context for the next session. Within an orchestration run, Workers execute phases autonomously and hand off through SESSION.md.

> Documents are frozen sessions. Relays are living handoffs.

---

## Agent Roles

**Principle:** Each agent owns one document type. Documents are frozen agents; agents are living documents.

| Agent        | Owns             | Function                                     |
| ------------ | ---------------- | -------------------------------------------- |
| Planner      | BRIEF            | Defines scope and intent before work begins  |
| Orchestrator | PLAN             | Sequences work and adapts when things change |
| Worker       | TASKS            | Executes one task at a time                  |
| Organizer    | CONTEXT.md files | Audits and maintains the context hierarchy   |

---

## Initiative Structure

```
docs/initiatives/
└── <initiative-name>/
    ├── BRIEF.md               # Intent, goals, scope — stable
    ├── PLAN.md                # Technical approach, decisions — semi-stable
    ├── TASKS.md               # Execution checklist — living
    ├── SESSION.md             # Orchestrator run log — append-only
    └── RELAY-<purpose>.md     # Session bootstrap prompts — never overwritten
```

Three source documents per initiative. SESSION.md and RELAY files are generated artifacts. If you feel the urge to create a fourth source document, that's a signal one of the three needs better organisation.

One active initiative at a time where possible. More than two and discipline breaks down.

---

## Documents

### BRIEF.md — The Anchor

Why this initiative exists and what it must achieve. Written at kickoff, rarely updated. Keep under half a page.

```markdown
# <Feature Name>

## Intent
What are we building and why? 1–3 sentences.

## Goals
- What does success look like? Be specific.

## Scope
In: ...
Out: ...

## Constraints
Technical constraints, dependencies, deadlines, non-negotiables.
```

Write it in plain language — no implementation details, that's PLAN.md. What's "out" is as important as what's "in". Only update if the fundamental goals or scope change.

---

### PLAN.md — The Design

How it's being built. Update when the approach changes, not when tasks complete.

```markdown
# <Feature Name> — Plan

## Approach
High-level architecture, key components, how they fit together.

## Technical Notes
Important implementation details, patterns, APIs, data models.

## Rejected Approaches
Append-only. One line each. Never cleaned up.

## Open Questions
- Unresolved decisions. Strike through when resolved.
```

If PLAN.md exceeds 150 lines, flag it to the user — do not fix it unilaterally.

---

### TASKS.md — The Checklist

What to do next. Tasks must be concrete and actionable.

```markdown
# <Feature Name> — Tasks

## Phase 1: <name>

- [x] Completed task
- [~] In-progress task
- [ ] Upcoming task
- [ ] 🔄 Handoff

# --- handoff point ---

## Phase 2: <name>

- [ ] Task
- [ ] 🔄 Handoff

## Deferred

[from: <initiative>] One-line note.
```

**Task status markers:** `[ ]` not started · `[~]` in progress (set by Orchestrator at dispatch only) · `[x]` complete

Size each phase for one session. When in doubt, smaller — a session that finishes early can pull the next phase; a session that overruns creates mess.

`🔄 Handoff` is a real task. It must be completed before the session ends.

`## Deferred` is for out-of-scope discoveries. Never actioned directly — consulted when planning new initiatives.

---

## Roles

### Planner

Makes work safe to start. Operates before an initiative begins and is re-engaged when the shape of an initiative needs to change.

**Responsibilities:**

- Write BRIEF.md — intent, goals, scope in/out, constraints
- Write PLAN.md — approach, key components, open questions
- Write TASKS.md — complete, ordered, session-sized task list; no task requiring more than one session; split those that do
- Place a `🔄 Handoff` task at the end of each phase
- Mark handoff boundaries in TASKS.md with `# --- handoff point ---`
- Surface Open Questions before handing off to the Orchestrator
- Re-engage when the Orchestrator flags that replanning is needed

**When spawned mid-initiative by the Orchestrator:**

1. Read the blocker detail passed by the Orchestrator
2. Read current BRIEF.md, PLAN.md, and TASKS.md
3. Determine scope of impact:
   - Only TASKS.md needs updating → update it, return `REPLANNED: ready to continue`
   - PLAN.md approach needs changing → update it and TASKS.md, return `REPLANNED: ready to continue`
   - BRIEF.md goals or constraints affected → do not change BRIEF.md unilaterally; surface to user with the decision, options, and implications; return `BLOCKED: needs user decision`
4. Never resume the Orchestrator loop without explicitly returning one of those two signals

**Does not:** write code, execute tasks, manage sessions.

---

### Orchestrator

Keeps work moving and notices when it isn't. Runs autonomously via the Task tool loop until the initiative is complete or an escalation condition is met.

**Execution model:**

1. Read BRIEF.md, PLAN.md, and TASKS.md
2. If Open Questions exist in PLAN.md — stop, surface to user, do not proceed
3. Find the first phase with at least one `[ ]` task
4. Mark the first `[ ]` task `[~]` in TASKS.md
5. Emit: `[ORCH] Dispatching Worker #N → Phase <X>: "<phase name>"`
6. Fill in the Worker Spawn Prompt (see template below), log it to SESSION.md, then pass it to the Task tool
7. Wait for the Worker to return
8. Verify: completed tasks are checked off in TASKS.md, at least one commit exists
9. Append a row to SESSION.md (see format below)
10. Emit the Worker result: `[ORCH] Worker #N → <DONE|PARTIAL|BLOCKED> (<commit>|—) — <one-line note>`
11. If DONE and verification passes → return to step 3
12. If all tasks complete → emit summary, update SESSION.md outcome, report to user, stop
13. If PARTIAL or BLOCKED → emit mandatory evaluation line, then triage:
    - **Yes, resolvable** (path issue, naming mismatch, already done by prior work) → emit `[ORCH] Adjusting and re-dispatching`, adjust and re-dispatch
    - **No, task scope or approach was wrong** → emit `[ORCH] Spawning Planner — <brief reason>`, spawn Planner via Task tool; pause loop until Planner returns
    - **BRIEF.md goals or constraints affected** → Planner surfaces to user; emit `[ORCH] Loop paused — awaiting user decision`
    - When in doubt, escalate — do not make judgment calls about scope unilaterally

This loop runs unattended. Stops only when all tasks are complete or an escalation condition is met.

**Status lines** — emit one after every decision point:

```
[ORCH] Dispatching Worker #N → Phase <X>: "<phase name>"
[ORCH] Worker #N → DONE (abc1234) — <note or "no notes">
[ORCH] Worker #N → PARTIAL (def5678) — completed tasks N–M, stopped before task N+1
[ORCH] Worker #N → BLOCKED (—) — <what failed and on which task>
[ORCH] Evaluating: resolvable without replanning? Yes — <reason>
[ORCH] Evaluating: resolvable without replanning? No — <reason>
[ORCH] Adjusting and re-dispatching
[ORCH] Spawning Planner — <brief reason>
[ORCH] Planner → REPLANNED: ready to continue
[ORCH] Planner → BLOCKED: needs user decision
[ORCH] Loop paused — awaiting user decision
[ORCH] Loop complete — N workers dispatched, N sessions, N unresolved blockers
```

The `[ORCH] Evaluating:` line is mandatory after every PARTIAL or BLOCKED. Skipping it is a protocol violation.

**Worker Spawn Prompt Template** — fill this in before each Task tool call, then log it to SESSION.md under the dispatch row:

```
You are a Worker agent operating within the [project name] initiative workflow.

Initiative: <name>
Phase: <N> — <phase name>
Initiative path: <path to initiative folder>

--- Worker Role (do not summarise or paraphrase) ---
[paste the full Worker section from this document verbatim]
---

Tasks assigned (from TASKS.md Phase <N>):
<paste the phase task list exactly as it appears in TASKS.md>

You are not the Orchestrator. Do not create documents, work across phases, or replan.
Return DONE, PARTIAL, or BLOCKED with specifics.
```

**SESSION.md** — created and maintained by the Orchestrator. Append after each Worker completes. When resuming an interrupted orchestration session, read SESSION.md first.

```markdown
# Session Log — <initiative name>

## <date>

| # | Phase | Result | Escalation evaluated? | Commit | Notes |
|---|-------|--------|-----------------------|--------|-------|
| 1 | Phase 1: <name> | DONE | No — clean completion | abc1234 | 5 tasks |
| 2 | Phase 2: <name> | PARTIAL | Yes → Planner: task scope wrong | def5678 | Tasks 1–3 done, stopped before task 4 |
| 3 | Phase 2 (cont.) | BLOCKED | Yes → User: BRIEF.md affected | — | <what failed> |

**Dispatch log:**
- Worker #1: [standard spawn prompt — full Worker section + Phase 1 task list]
- Worker #2: [standard spawn prompt — full Worker section + Phase 2 task list]

**Outcome:** <Loop complete | Paused — awaiting user decision | Paused — blocker>
```

**Does not:** write code, execute tasks, or replan unilaterally.

---

### Worker

Executes all tasks in an assigned phase and leaves the project in a clean state. Operates within a single session.

**Responsibilities:**

- Read BRIEF.md, PLAN.md, and TASKS.md at session start
- Work on the assigned phase — execute tasks in order from the first `[~]` or `[ ]` through to the phase's `🔄 Handoff`
- Check off each task in TASKS.md immediately upon completion — do not batch
- Commit after each task — a commit per task makes partial recovery clean
- Update PLAN.md if the technical approach changed
- Append to `## Rejected Approaches` in PLAN.md if something was tried and abandoned
- Add to `## Deferred` in TASKS.md for any out-of-scope discoveries
- Commit all work before ending — even incomplete work with `WIP:` prefix

**Context pressure:** Monitor context usage continuously. At ~60% context with tasks remaining:

- Finish the current task if close to done; otherwise finish the smallest completable unit
- Commit completed work normally; commit partial work with `WIP:` prefix
- Return `PARTIAL` — list what's done, what's partial, what hasn't started
- The Orchestrator will re-dispatch a new Worker to continue

**Return values:**

| Trigger | Return |
|---------|--------|
| Task complete | `DONE: [task name]` — commit hash, any notes for PLAN.md |
| Context pressure, task not nearly done | `PARTIAL: [task name]` — what was completed, what remains, committed as WIP |
| Blocker encountered | `BLOCKED: [task name]` — what was attempted, what failed, what's needed |

Session notes: omit if nothing significant; inline (1–3 lines) if minor; append to `## Session Notes [date]` in PLAN.md if more than 3 lines.

**Does not:** skip tasks, work across phases, create new documents, replan.

---

### Organizer

Audits the project's context hierarchy and ensures significant directories have accurate `CONTEXT.md` files. Always invoked explicitly via `role:organizer` — never spawned automatically.

**Responsibilities:**

- Walk the project structure as defined in PROJECT.md
- Assess each directory: does it warrant a `CONTEXT.md`? (Non-trivial contents, not self-explanatory by name and file list alone)
- Present findings before creating anything:
  ```
  Missing (recommended):
    tools/sprite-assigner/   — 12 files, no CONTEXT.md
  Stale (possibly):
    codeql/CONTEXT.md        — references databases/ which is now gitignored
  No action needed:
    packages/types/          — 3 files, self-explanatory
  ```
- Wait for user confirmation before writing any files
- Write confirmed files one at a time, pausing to confirm approach before continuing
- A `CONTEXT.md` should contain: what the directory is for, what each significant file or subdirectory does, when a session should load it

**Does not:** create files without confirmation, modify source files, run as part of the initiative loop.

---

## Session Management

AI agent sessions have a finite context window. Quality degrades as context fills. **Never exceed ~70% context usage in a single session.**

When writing TASKS.md, estimate phase size: 5–10 files with moderate complexity is about right for one phase. Phases requiring many large reference docs or intricate logic should be smaller.

### Worker Phase Boundary

When a Worker reaches a `🔄 Handoff` task, **or** is approaching ~70% context with tasks remaining:

1. **Update TASKS.md.** Check off everything completed. Note anything partial inline.
2. **Commit.** Branch: `feat/<initiative-slug>` or `feat/<initiative-slug>-phase-N`. Use `WIP:` prefix for mid-flight work. A session must never end with uncommitted changes.
3. **Return** `DONE` (or `PARTIAL` if context-pressured before reaching the handoff task) to the Orchestrator.

The Orchestrator handles continuity from here — it reads TASKS.md and SESSION.md to determine what runs next, and constructs the next Worker's spawn prompt from those. No file is written by the Worker at a phase boundary.

A session that _could_ keep going **must still execute the handoff** when it reaches a `🔄 Handoff` task. The next session starts with a full context window. Context compression is not a substitute for a clean phase boundary.

---

## Relays

A Relay is a structured prompt written at the end of a session that bootstraps the next session with a specific role and full context. You copy it, open a new session with `/new`, and paste it in.

Relays are always written on request — by the current session, for the next one. They are saved as files in the initiative folder and never overwritten, because they are a record of how each phase began.

**When a Relay is needed:**

| From | To | File | Trigger |
|------|----|------|---------|
| Research / ideation session | `role:planner` | `RELAY-planner.md` | Enough explored to start an initiative |
| Planner session | `role:orchestrator` | `RELAY-orchestrator.md` | Initiative docs complete, ready to build |
| Orchestrator session | Bugfix / playtesting session | `RELAY-bugfix-<date>.md` | Build complete, testing needed |

**Relay template:**

```markdown
# Relay — <from session type> → <to session type> — <date>

role:<target role>

## Context
<1–3 sentences: what led to this relay. What was researched, decided, or built.>

## Load these files
- .context/PROJECT.md
- .context/PROTOCOL.md
- <initiative path>/BRIEF.md
- <initiative path>/PLAN.md
- <initiative path>/TASKS.md
- <any other files directly relevant to what comes next>

## State
Branch: <branch | n/a>
Build: <passing | broken — explain if broken | n/a>
TASKS.md current: <yes | no | n/a>

## What was done
<One line per significant decision, document written, or conclusion reached.
For a bugfix relay: one line per area of known issues or test coverage gaps.>

## Your task
<Precise instruction for what the next session should do first.
For role:planner → write the initiative docs.
For role:orchestrator → run the initiative named above.
For bugfix → what to test or investigate first.>

## Open questions
<Anything unresolved that the next session should be aware of. Empty if none.>
```

---

## Escalation Paths

In order of severity:

**Worker hits context pressure mid-task**
→ Finish the smallest completable unit → commit `WIP:` → return `PARTIAL`
→ Orchestrator emits evaluation line, re-dispatches or escalates to Planner

**Worker encounters a blocker**
→ Document in `## Rejected Approaches` in PLAN.md → add to `## Open Questions`
→ Return `BLOCKED` → Orchestrator emits evaluation line, escalates to Planner

**Orchestrator sees repeated failure or drift**
→ Stop dispatching → send replan request to Planner with specifics
→ Do not resume until Planner confirms task list is updated

**Planner cannot resolve without user input**
→ Surface to user: what the decision is, what the options are, what the implications are
→ Do not proceed until user decides
→ If user is unavailable, add to `## Open Questions` in PLAN.md, mark initiative blocked

**Any agent encounters something outside its role**
→ Escalate up one level — Worker → Orchestrator → Planner → user
→ Never act outside your defined responsibilities unilaterally

---

## Git

Branch for every initiative: `feat/<initiative-slug>` or `design/<what-youre-trying>`.

- Always commit before switching branches, even broken work. `WIP:` prefix freely.
- Commit at every meaningful checkpoint — at minimum, at every `🔄 Handoff`.
- A session must never end with uncommitted changes.
- Abandoned branches stay. They are history.

---

## Maintenance Rules

1. **No orphan documents.** Every file in an initiative folder is one of: BRIEF.md, PLAN.md, TASKS.md, SESSION.md, RELAY-*.md.
2. **No stale tasks.** If a task is no longer relevant, remove it.
3. **One active focus.** At most one or two initiatives in active development at once.
