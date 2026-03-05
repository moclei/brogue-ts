# Phase 6: Stabilization

## Intent
Through iterative playtesting and bug fixing, bring the TypeScript port to "feature-complete playable" quality. Phases 0–5 ported all code, wired all systems, and resolved the first round of integration bugs. Phase 6 is the ongoing stabilization effort: play the game, find what's broken, fix it, repeat.

## Goals
- A player can complete a full run from depth 1 to depth 26 (or die trying)
- All core gameplay systems work correctly: combat, items, monsters, terrain, stairs, status effects
- Visual rendering matches the C version (colors, glyphs, animations, fog of war)
- Input works fully: keyboard commands, mouse click-to-move, mouse hover for inspect/path preview
- No crashes, hangs, or obviously broken behaviors during normal play

## Scope

What's in:
- Bugs found via manual playtesting
- Integration issues where wired functions don't behave correctly at runtime
- Missing behaviors in simplified/stubbed implementations
- Rendering bugs (wrong colors, missing effects, incorrect cell appearance)
- Input handling gaps (missing event types, incorrect dispatch)

What's out:
- Save/load system (needs storage backend — separate initiative)
- Recording playback (separate verification concern)
- Debug/wizard-mode displays (cosmetic, low priority)
- Node.js terminal platform (separate initiative)
- Main menu performance optimization (separate initiative)
- New gameplay features or balance changes

## Constraints
- No changes to game logic — fixes should align with C behavior
- DI context pattern preserved (no global state)
- TypeScript strict mode throughout
- All existing tests must continue to pass
- Each fix should be verified with both automated tests and manual playtesting

## Structure
Bugs are tracked as numbered playtest rounds. Each round represents a playtesting session and the bugs discovered in it.
