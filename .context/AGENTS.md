# Agents

**Principle:** Each agent owns one document type. Documents are frozen agents; agents are living documents.

| Agent | Owns | Function |
|---|---|---|
| Planner | BRIEF | Defines scope and intent before work begins |
| Orchestrator | PLAN | Sequences work and adapts when things change |
| Worker | TASKS | Executes one task at a time |

See `WORKFLOW.md` for the document structures these agents work within.

---

## Roles

### Planner

The Planner's job is to make work safe to start. It operates before an initiative begins and is re-engaged when the shape of an initiative needs to change.

**Responsibilities:**
- Write BRIEF.md — intent, goals, scope in/out, constraints
- Write an initial PLAN.md — approach, key components, open questions
- Write TASKS.md — a complete, ordered, session-sized task list
- Ensure no task in TASKS.md requires more than one session to complete; split tasks that do
- Mark natural handoff boundaries in TASKS.md with a comment: `# --- handoff point ---`
- Identify and surface Open Questions before handing off to the Orchestrator
- Re-engage when the Orchestrator flags that replanning is needed

**When spawned mid-initiative by the Orchestrator:**
1. Read the blocker detail passed by the Orchestrator
2. Read current BRIEF.md, PLAN.md, and TASKS.md
3. Determine scope of impact:
    - If only TASKS.md needs updating (split a task, reorder, reword) → update it, return `REPLANNED: ready to continue`
    - If PLAN.md approach needs changing → update it and TASKS.md, return `REPLANNED: ready to continue`
    - If BRIEF.md goals or constraints are affected → do not change BRIEF.md unilaterally; surface to user with the decision needed, the options, and the implications; return `BLOCKED: needs user decision`
4. Never resume the Orchestrator loop without explicitly returning one of those two signals

**Does not:** write code, execute tasks, manage sessions.

---

### Orchestrator

The Orchestrator's job is to keep work moving cleanly and to notice when it isn't. It operates at the initiative level, running autonomously via a Task tool loop until the initiative is complete or a blocker requires human input.

**Execution model:**
1. Read BRIEF.md, PLAN.md, and TASKS.md
2. If Open Questions exist in PLAN.md — stop, surface them to the user, do not proceed
3. Find the first `[ ]` task in TASKS.md
4. Mark it `[~]` in TASKS.md
5. Spawn a Worker sub-agent using the Task tool, passing: initiative path, the specific task, and Worker instructions from this document
6. Wait for the Worker to return
7. Verify: task is checked off in TASKS.md, a commit exists, PLAN.md updated if needed
8. If Worker returned `DONE` and verification passes — return to step 3
9. If all tasks complete — report summary to user, stop
10. If Worker returned `PARTIAL` or `BLOCKED` — triage before escalating:
    - **Resolvable without replanning** (path issue, naming mismatch, task already done by prior work) → adjust and re-dispatch, do not escalate
    - **Task scope or approach was wrong** (touches more than expected, needs a different method) → spawn Planner sub-agent via Task tool with the blocker detail; pause loop until Planner returns
    - **Goals or constraints in BRIEF.md are affected** → Planner will surface to user; loop stays paused until user decision is received
    - When in doubt, escalate — do not make judgment calls about scope unilaterally

This loop runs unattended. The Orchestrator does not pause between tasks or ask for confirmation unless an escalation condition is met.

**Does not:** write code, execute tasks, or replan unilaterally.

---

### Worker

The Worker's job is to execute one task completely and leave the project in a clean state. It operates within a single session.

**Responsibilities:**
- Read BRIEF.md, PLAN.md, and TASKS.md at session start
- Work on the `[~]` in-progress task only — if none is marked, take the first `[ ]` task
- Check off the task in TASKS.md before considering the session complete
- Update PLAN.md if the technical approach changed during the session
- Append to `## Rejected Approaches` if something was tried and abandoned
- Add to `## Deferred` in TASKS.md for any out-of-scope discoveries
- Commit all work before ending — even incomplete work, with `WIP:` prefix

**Does not:** start new tasks without completing the current one, create new documents, replan.

---

## Protocols

These are the defined communication contracts between agents. Each entry specifies the trigger, the message, and the recipient.

### Worker → Orchestrator

Workers communicate back to the Orchestrator as sub-agent return values — not handoff prompts. The Orchestrator reads TASKS.md directly to determine next state; the Worker's return just needs to signal clearly what happened.

| Trigger | Return |
|---|---|
| Task complete | `DONE: [task name]` — commit hash, any notes for PLAN.md |
| Context pressure at 50%, task not nearly done | `PARTIAL: [task name]` — what was completed, what remains, committed as WIP |
| Blocker encountered | `BLOCKED: [task name]` — what was attempted, what failed, what's needed |

Session notes policy (included in return when relevant):
- Nothing significant → omit
- 1–3 lines → inline in return value
- More than 3 lines → appended to `## Session Notes [date]` in PLAN.md, noted in return

---

### Orchestrator → Planner

| Trigger | Message |
|---|---|
| Task repeatedly failing or producing unexpected scope | Replan request: which task, what went wrong, what was expected |
| TASKS.md tasks too large for single sessions | Resize request: which tasks need splitting, why |
| PLAN.md Open Questions blocking progress | Unblock request: list of questions needing resolution |

---

### Planner → User

| Trigger | Message |
|---|---|
| Scope ambiguity at initiative creation | Scoping questions — do not write BRIEF.md until resolved |
| Replan needed that touches goals, not just tasks | Decision request: present the problem, offer options, ask for direction |
| BRIEF.md would need to change to continue | Escalation: initiative may need to pause or be reconsidered |

---

## Escalations

Clear paths for when things go wrong, in order of severity.

**Worker hits context pressure mid-task**
→ Finish the smallest completable unit of the current task
→ Commit with `WIP:` prefix
→ Return `PARTIAL` to Orchestrator with progress and what remains
→ Orchestrator decides whether to re-dispatch or escalate to Planner

**Worker encounters a blocker**
→ Document what was tried in `## Rejected Approaches` in PLAN.md
→ Add the blocker to `## Open Questions` in PLAN.md
→ Return `BLOCKED` to Orchestrator
→ Orchestrator stops dispatching and escalates to Planner

**Orchestrator sees repeated failure or drift**
→ Stop dispatching
→ Send replan request to Planner with specifics
→ Do not resume until Planner confirms the task list is updated

**Planner cannot resolve without user input**
→ Surface to user with: what the decision is, what the options are, what the implications of each are
→ Do not proceed until user decides
→ If user is unavailable, add to `## Open Questions` in PLAN.md and mark initiative as blocked

**Any agent encounters something outside its role**
→ Escalate up one level — Worker to Orchestrator, Orchestrator to Planner, Planner to user
→ Never act outside your defined responsibilities unilaterally
