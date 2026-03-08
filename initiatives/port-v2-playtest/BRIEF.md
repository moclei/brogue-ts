# Port V2 — Playtest

## Intent

Make the game mechanically complete and interactively playable in the browser.
All non-persistence stubs are wired or implemented. The game can be run, a new game
started, a dungeon explored, monsters fought, items used, and a full run completed.

## Goals

- All 106 non-persistence stubs resolved (WIRE + PORT + TRIVIAL categories)
- Player sees messages, dungeon updates, sidebar updates
- Monster AI runs every turn: movement, state transitions, scent, pathfinding
- Player can pick up items, fight, equip/unequip, use staves/wands
- Help screen, discoveries screen, feats screen accessible
- Browser smoke test: full run playable end-to-end
- All fixed test.skip entries removed or converted to active tests

## Scope

What's in:
- Wire 48 existing implementations into context builders (message, display, turn AI, etc.)
- Port 31 functions that have no TS implementation yet (pickUpItemAt, resolvePronounEscapes, etc.)
- Wire 27 trivial/passthrough stubs (strLenWithoutEscapes, terrainFlags, etc.)
- Browser playtesting and bug fixes

What's out (explicitly deferred to port-v2-persistence):
- save/load (.broguesave) — 10 file I/O functions
- recording/playback (.broguerec) — 13 recording functions
- High scores persistence — printHighScores, saveHighScore
- Level revisit (restoreItems, restoreMonster) — depends on persistence layer

## Prerequisites

- `port-v2-verify-mechanics` complete ✓ (all 72 domain functions + verification)
- `port-v2-fix-rendering` complete ✓ (getCellAppearance, refreshDungeonCell domain)
- commitDraws wired to canvas (just fixed in bootstrap)
- 87 files, 2171 pass, 141 skip as of initiative start

## Source references

- All stub locations: `rogue-ts/tests/` (test.skip entries)
- Context builders: `src/movement.ts`, `src/items.ts`, `src/combat.ts`, `src/turn.ts`,
  `src/monsters.ts`, `src/lifecycle.ts`, `src/ui.ts`, `src/io/input-context.ts`
- IO implementations: `src/io/messages.ts`, `src/io/display.ts`, `src/io/buttons.ts`,
  `src/io/input-keystrokes.ts`, `src/io/cell-appearance.ts`
- Domain implementations: `src/monsters/`, `src/items/`, `src/time/`, `src/movement/`
