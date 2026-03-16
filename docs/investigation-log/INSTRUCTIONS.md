# Investigation Log — Session Instructions

## Purpose
Temporary effort to understand our investigation workflow so we can identify
where better tooling (CodeQL, grep, targeted reads) could shorten diagnosis time.
Once we have enough samples to draw conclusions, stop including this file.

## Files
- `INSTRUCTIONS.md` — this file (include in session prompt to activate logging)
- `LOG.md` — running log of all investigations, append-only

## During an investigation
Log every tool call to `LOG.md` as it happens, in this format:

```
- <one-sentence reasoning> — <tool>: <query or target> → <one-phrase result>
```

Examples:
```
- Suspected stub — Grep: "monsterCanSubmerge" in src/ → 4 hits across 3 files
- Narrowing to wiring context — CodeQL find-callers: buildMonstersTurnContext → 1 call site, turn-monster-ai.ts:189
- Confirming stub value — Read: turn-monster-ai.ts:189-225 → stub confirmed at line 219
```

## Starting an entry
When a bug investigation begins, open a new entry in LOG.md:

```
## BXX — <short description>
Symptom: <what the player observed>
```

## Closing an entry
When root cause is identified, append:

```
Root cause: <one line>
Steps logged: <n>
```

## Notes
- One sentence of reasoning before each tool call — the "because" that motivated it
- Do not log file contents or extended explanation
- If a tool call returns nothing useful, still log it: `→ no results`
- Do not clean up or summarize mid-investigation; raw is fine for now
