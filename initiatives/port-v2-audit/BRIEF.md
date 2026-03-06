# Port V2 — C Source Audit

## Intent

Systematically verify that every function in the C source (`src/brogue/`) is accounted for in the
TypeScript port (`rogue-ts/src/`). Produce a prioritized gap list that drives the next phase of work.

## Background

The V2 port copied ~82 game-logic files from the V1 port rather than from C directly. V1 was
"working, playable code" with correct game logic but an architectural problem (monolithic runtime.ts).
However, V1 also had functions that were explicitly deferred and never implemented — most critically
`getCellAppearance` and `refreshDungeonCell` in the IO rendering layer. When V2 ported V1's IO layer,
it ported the primitives but not the deferred functions. There may be other such gaps.

This audit answers the question: **what exactly is missing, and where?**

## Goals

- Every C function in every audited file is classified into exactly one category (see PLAN.md)
- A gap file exists for each audited C file: `docs/audit/gaps-{Filename}.md`
- A synthesis document `docs/audit/summary.md` consolidates findings and prioritizes by gameplay impact
- A follow-on initiative is created to address critical gaps

## Scope

**In scope:** All `.c` files in `src/brogue/` — the game logic layer. Ordered by risk (files that
touch areas known to have issues first):

1. `IO.c` — rendering, display, UI (confirmed gap: getCellAppearance, refreshDungeonCell, displayLevel)
2. `Items.c` — item handling (largest file; many callbacks stubbed in wiring layer)
3. `Monsters.c` — monster logic
4. `Architect.c` — dungeon generation
5. `Movement.c` — player movement
6. `Time.c` — turn processing
7. `Combat.c` — combat resolution
8. `RogueMain.c` — game lifecycle, main loop
9. `MainMenu.c` — menus (largely ported in port-v2-platform)
10. `Buttons.c` — button UI (largely ported)
11. `Light.c` — lighting system (dependency of IO.c rendering)
12. `Recordings.c` — playback system (lower priority; stubs are acceptable for browser)
13. `Wizard.c` — wizard mode (partially ported)
14. `Grid.c`, `Math.c`, `Dijkstra.c` — utilities (highest confidence; have most tests)
15. `PowerTables.c`, `SeedCatalog.c`, `Globals.c`, `Utilities.c` — data/constants

**Out of scope:** `src/platform/` — SDL2, curses, web IPC backends. These are replaced entirely by
the browser canvas renderer and are not relevant to the TS port's game logic.

## Constraints

- Each session handles exactly one C file. No exceptions.
- Sessions do not read C source files or large TS files directly. They work from inventory files.
- Do not fix gaps found during audit. Record them. Fix work goes in a separate initiative.
- Do not modify `rogue-ts/src/` during this initiative.
