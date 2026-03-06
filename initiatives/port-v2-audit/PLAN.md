# Port V2 — C Source Audit — Plan

## Approach

Two-pass process:

1. **Inventory phase** (one session): Run scripts to extract all C function names and all TS
   function annotations into structured files under `docs/audit/`. These files are the input
   for all subsequent sessions. No AI session reads raw C or large TS files directly.

2. **Cross-reference phase** (one session per C file): Read the inventory entries for one C file,
   grep the TS source for specific names, classify each function, write a gap file. Commit and stop.

3. **Synthesis phase** (one session): Read all gap files, produce `docs/audit/summary.md` with
   counts, prioritized critical gaps, and a plan for the follow-on fix initiative.

---

## Category Definitions

Every C function must be assigned exactly one category. Use these definitions consistently across
all sessions:

| Category | Meaning |
|---|---|
| `IMPLEMENTED` | A TS function exists, is wired into at least one context builder, and has at least one passing test verifying its behavior. |
| `STUBBED-TRACKED` | A TS function exists as a no-op (`() => {}` or equivalent) AND has a corresponding `test.skip` entry documenting the correct behavior. Rule is satisfied. |
| `STUBBED-UNTRACKED` | A TS function exists as a no-op but has NO corresponding `test.skip`. Rule violation — must be fixed. |
| `MISSING` | No TS equivalent found anywhere in `rogue-ts/src/`. |
| `NEEDS-VERIFICATION` | A TS function exists but appears simplified relative to C (e.g., always returns a constant, ignores parameters, or skips major branches). Needs human review to determine if the simplification is intentional. |
| `OUT-OF-SCOPE` | C function is platform-specific (file I/O, SDL, POSIX signals, terminal control) and is either not needed or has a known browser substitute already in place. |
| `DATA-ONLY` | C function is purely data initialization (populates an array/struct with constants). Equivalent data exists in a TS catalog file. |

**When in doubt between IMPLEMENTED and NEEDS-VERIFICATION:** assign NEEDS-VERIFICATION.
It is better to flag something for human review than to assume it is correct.

---

## Session Protocol

**Every session follows these steps in order. Do not deviate.**

### Inventory session (Phase 1 only)

1. Read this PLAN.md and TASKS.md.
2. Run the inventory scripts (see below). Do not read their full output in context — write it to files.
3. Commit `docs/audit/c-inventory.md` and `docs/audit/ts-inventory.md`.
4. Check off the Phase 1 tasks in TASKS.md.
5. Stop. Do not begin any cross-reference work.

### Cross-reference session (Phase 2, one C file per session)

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked Phase 2 task.
2. Read the section of `docs/audit/c-inventory.md` for the target C file only.
   (The file is organized by C filename — search for the `## Filename.c` header.)
3. For each function listed:
   a. Convert the C name to its likely TS camelCase equivalent.
   b. Run: `grep -rn "functionName" rogue-ts/src/ --include="*.ts" | head -5`
   c. If found: check if it is a stub (`() => {}` body) or has real implementation.
   d. If found as stub: check for a matching `test.skip`: `grep -rn "stub.*functionName" rogue-ts/tests/`
   e. Assign a category from the definitions above.
4. Write `docs/audit/gaps-{Filename}.md` using the output template below.
5. Check off the task in TASKS.md. Add any notes about unexpected findings.
6. Commit. Stop. Do not start the next file.

### Synthesis session (Phase 3)

1. Read BRIEF.md, PLAN.md, TASKS.md.
2. Read all `docs/audit/gaps-*.md` files.
3. Count totals per category across all files.
4. Identify critical gaps: functions that are MISSING or STUBBED-UNTRACKED in systems required
   for basic gameplay (rendering, movement, combat, level generation).
5. Write `docs/audit/summary.md` (see template below).
6. Update TASKS.md to reflect completion.
7. Commit.

---

## Inventory Scripts

Run these from the repository root. They write to files — do not read large output in context.

### C inventory

Extracts all function definitions from each game logic C file. A "function definition" is a line
that starts with a return type keyword, contains a function name and `(`, and is followed by `{`.

```bash
#!/bin/bash
# Run from repo root
OUT="docs/audit/c-inventory.md"
echo "# C Function Inventory" > "$OUT"
echo "" >> "$OUT"
echo "Generated from \`src/brogue/\` — game logic layer only." >> "$OUT"
echo "Each section lists function definitions found in that file." >> "$OUT"

for FILE in src/brogue/IO.c src/brogue/Items.c src/brogue/Monsters.c \
            src/brogue/Architect.c src/brogue/Movement.c src/brogue/Time.c \
            src/brogue/Combat.c src/brogue/RogueMain.c src/brogue/MainMenu.c \
            src/brogue/Buttons.c src/brogue/Light.c src/brogue/Recordings.c \
            src/brogue/Wizard.c src/brogue/Grid.c src/brogue/Math.c \
            src/brogue/Dijkstra.c src/brogue/PowerTables.c src/brogue/SeedCatalog.c \
            src/brogue/Globals.c src/brogue/Utilities.c; do
    BASENAME=$(basename "$FILE")
    echo "" >> "$OUT"
    echo "## $BASENAME" >> "$OUT"
    echo "" >> "$OUT"
    # Match lines that look like function definitions:
    # - Start with optional 'static'
    # - Have a return type and function name with '('
    # - End with '{' (same line) or are followed by it
    grep -n "^[a-zA-Z].*([^;]*{$\|^static [a-zA-Z].*([^;]*{$" "$FILE" 2>/dev/null | \
        grep -v "^[0-9]*:[[:space:]]*//" | \
        grep "(" | \
        sed "s/^/- Line /" >> "$OUT" || true
done

echo "" >> "$OUT"
echo "---" >> "$OUT"
echo "Generated $(date)" >> "$OUT"
```

### TS inventory

Extracts all TS exported functions that have a `C:` annotation indicating what C function they port.
Also extracts stub patterns for cross-checking.

```bash
#!/bin/bash
# Run from repo root
OUT="docs/audit/ts-inventory.md"
echo "# TypeScript Function Inventory" > "$OUT"
echo "" >> "$OUT"
echo "Exported functions in \`rogue-ts/src/\` that have C-source annotations." >> "$OUT"
echo "Format: file:line | C annotation | function name" >> "$OUT"
echo "" >> "$OUT"

echo "## Functions with C: annotations" >> "$OUT"
echo "" >> "$OUT"
grep -rn "C: \`" rogue-ts/src/ --include="*.ts" | \
    sed 's/^/- /' >> "$OUT"

echo "" >> "$OUT"
echo "## Stub patterns (no-op implementations)" >> "$OUT"
echo "" >> "$OUT"
grep -rn "// stub\|: () => {}\|: () => \[\]\|: () => 0\|: () => false\|: () => null\|: () => \"\"\|: () => ''" \
    rogue-ts/src/ --include="*.ts" | \
    grep -v "test\|spec\|\.md" | \
    sed 's/^/- /' >> "$OUT"

echo "" >> "$OUT"
echo "## test.skip entries (tracked stubs)" >> "$OUT"
echo "" >> "$OUT"
grep -rn "test\.skip\|it\.skip\|describe\.skip" rogue-ts/tests/ | \
    sed 's/^/- /' >> "$OUT"

echo "" >> "$OUT"
echo "---" >> "$OUT"
echo "Generated $(date)" >> "$OUT"
```

---

## Output Templates

### Gap file: `docs/audit/gaps-{Filename}.md`

```markdown
# Audit: {Filename}.c

**Status:** Complete
**Audited:** YYYY-MM-DD
**Auditor note:** (any session-specific observations)

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| getCellAppearance | 1094 | — | MISSING | Never implemented in V1 or V2 |
| refreshDungeonCell | 1504 | — | MISSING | Stubbed in ui.ts; no implementation |
| displayLevel | 910 | lifecycle.ts:479 | STUBBED-UNTRACKED | No test.skip entry |
| plotCharWithColor | 1700 | io/display.ts:142 | IMPLEMENTED | Has tests in display.test.ts |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 0 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 0 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **0** |

## Critical Gaps

List only MISSING and STUBBED-UNTRACKED items here, ordered by gameplay impact:

1. `functionName` — reason it matters
2. ...

## Notes for follow-on initiative

Any observations about dependencies, porting complexity, or sequencing that will be
useful when planning the fix work.
```

### Summary file: `docs/audit/summary.md`

```markdown
# Audit Summary

**Completed:** YYYY-MM-DD
**Files audited:** N / N

## Overall Coverage

| Category | Count | % of total |
|---|---|---|
| IMPLEMENTED | | |
| STUBBED-TRACKED | | |
| STUBBED-UNTRACKED | | |
| MISSING | | |
| NEEDS-VERIFICATION | | |
| OUT-OF-SCOPE | | |
| DATA-ONLY | | |
| **Total** | | |

## Critical Gaps (required for basic gameplay)

These must be addressed before the game is playable:

| Function | C File | Category | Impact |
|---|---|---|---|
| getCellAppearance | IO.c | MISSING | Level rendering completely absent |
| ... | | | |

## Secondary Gaps (gameplay incomplete without, but not blocking)

## Rule Violations (STUBBED-UNTRACKED — test.skip entries needed)

## Out-of-scope / acceptable gaps

## Recommended follow-on initiative

Brief description of what the fix initiative should tackle first, second, and third.
```

---

## Open Questions

- None at start. Add here if a session encounters something unexpected.
