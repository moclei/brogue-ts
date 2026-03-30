# Workflow

**Principle:** Documentation should reduce friction, not create it. Every document must earn its existence.

See `AGENTS.md` for the team that works within this structure.

---

## Structure

```
.context/
├── PROJECT.md              # Project-level context — what, why, where things live
├── WORKFLOW.md             # This file — the work artifacts
└── AGENTS.md               # The team — roles, protocols, escalations
initiatives/
└── <initiative-name>/
    ├── BRIEF.md            # Intent, goals, scope — stable
    ├── PLAN.md             # Technical approach, decisions — semi-stable
    └── TASKS.md            # Execution checklist — living
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

"What's out" is as important as "what's in." If BRIEF.md is updated frequently, scope is unstable — resolve that before continuing.

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

If PLAN.md exceeds 150 lines, flag it to the user: _"PLAN.md is getting long — consider pruning old notes or splitting this initiative."_ Do not fix it unilaterally.

---

### TASKS.md — The Checklist

What to do next. Tasks must be concrete and actionable. Check off on completion. Remove tasks that are no longer relevant.

Use phases if the initiative has natural stages; skip them if not.

Tasks should be sized so each can be completed comfortably within a single session. If a task requires more than one session, split it. The Planner is responsible for this sizing at initiative creation.

```markdown
## Phase 1: <name>

- [x] Completed task
- [~] Task currently in progress (set by Orchestrator at dispatch)
- [ ] Upcoming task

## Deferred

[from: initiative-name] One-line note.
```

`## Deferred` is for out-of-scope discoveries or cross-initiative findings. Never actioned directly — consulted when starting new initiatives.

---

## Lifecycle

**Starting:** Create folder under `initiatives/`. Write BRIEF.md first — clarity on scope before any code. Then PLAN.md, then TASKS.md. Reference in PROJECT.md if significant.

**During:** Update TASKS.md as you work — a task isn't done until TASKS.md reflects it. Update PLAN.md if the approach changes. Update BRIEF.md only if goals shift.

**Completing:** All tasks checked off or removed. Open Questions empty or resolved. Folder stays as history.

**Abandoning:** Add `**Status: Abandoned — <reason>**` to the top of BRIEF.md. Don't delete the folder.

---

## Git

Branch for every initiative or exploratory direction. Name branches `feat/<thing>` or `design/<what-youre-trying>`.

- Always commit before switching branches, even broken work. Use `WIP:` prefix freely.
- Commit at every meaningful checkpoint — at minimum, at the end of every session.
- Abandoned branches stay. They are history.
