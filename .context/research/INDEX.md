# Research Index

Pre-computed understanding of game mechanics and systems. Each document captures
the results of a deep-dive investigation so future sessions can load cached
knowledge instead of re-deriving it from source.

## How to use

- **Before investigating a system**, check this index. If a doc exists, read it
  instead of grepping/reading source files.
- **When creating a new research doc**, use the template at the bottom of this file
  and add a row to the table below.
- **Staleness**: each doc records a `Last verified` date. If you notice the code
  has materially changed since then, update the doc or flag it as stale in the
  Status column.

## Documents

| Topic | File | Status | Summary |
|-------|------|--------|---------|
| Grid System | grid-system.md | current | 2D grid allocation, pcell/tcell, dungeon dimensions, terrain flags, key globals |
| UI Overlay Systems | ui-overlay-systems.md | current | Display buffers, sidebar, messages, inventory, buttons, targeting, effects, platform rendering |

<!-- When adding a row:
| Grid System | grid-system.md | current | 2D grid allocation, pcell/tcell, dungeon dimensions, terrain flags |
-->

---

## Research Document Template

Use this structure when creating a new research doc. Copy it as a starting point.

~~~markdown
# [System Name]

> Last verified: YYYY-MM-DD | Commit: [short hash]

## Summary

2-3 sentences: what this system does in the game and why it matters.

## Key Files

| File (C) | File (TS) | Responsibility |
|----------|-----------|----------------|

## Key Functions

| Function | File | Purpose |
|----------|------|---------|

## Data Structures

Key types, structs, interfaces with field explanations.

## Flow

How data moves through the system. Call chains, sequence of operations,
lifecycle. Use numbered steps or diagrams as appropriate.

## Integration Points

How this system connects to other systems. Which systems depend on it,
which systems it depends on.

## Constraints & Invariants

Rules the system enforces. Things that must remain true for correctness.

## Modification Notes

What to watch out for when changing this system. Common pitfalls,
hidden dependencies, performance considerations.
~~~
