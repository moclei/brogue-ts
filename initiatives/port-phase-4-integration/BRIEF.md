# Phase 4: Integration

## Intent
Turn the fully-ported TypeScript codebase into a working, verified game. Phases 0–3 ported all ~38K lines of C source into ~57K lines of TypeScript across 118 source files. Phase 4 connects the remaining loose ends, fixes compilation errors, gets the game running in a browser, and validates correctness against the C reference implementation.

## Goals
- Zero TypeScript compilation errors
- Game launches in the browser: title screen renders, flame animation plays, menu buttons work
- A new game can be started: dungeon generates, player appears, basic movement works
- Seed determinism: same seed produces the same dungeon layout as the C version
- Recording playback: C-generated `.broguerec` files play back without OOS errors
- All existing tests continue to pass
- Node.js terminal platform as secondary target

## Scope

What's in:
- Fix all 51 pre-existing compilation errors (unused imports, missing flags, type mismatches)
- Complete the runtime DI wiring (fill remaining TODO stubs in `runtime.ts`)
- Add missing flag constants (`T_DIVIDES_LEVEL`, `T_RESPIRATION_IMMUNITIES`, `T_PATHING_BLOCKER`, `xpxpThisTurn`)
- Fix barrel export collisions and missing members
- Build tooling setup (bundler for browser delivery)
- Async boundary resolution (synchronous C calls → async browser equivalents)
- Seed catalog regression tests
- Recording playback verification
- Node.js terminal platform (`curses`-style or raw ANSI)

What's out:
- New gameplay features or balance changes
- Graphical tile rendering (text-only for now)
- React Native or mobile platforms
- Performance optimization beyond what's needed for playability
- Comprehensive test coverage for every ported function (existing ~1,500 tests are sufficient baseline)

## Constraints
- No changes to game logic — the C source remains the source of truth
- DI context pattern must be preserved (no global state)
- TypeScript strict mode throughout
- All changes must be backward-compatible with existing tests
