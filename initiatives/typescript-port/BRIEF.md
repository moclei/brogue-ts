# TypeScript Port of BrogueCE

## Intent

Port Brogue: Community Edition v1.15.1 from C to idiomatic TypeScript, producing a faithful implementation that can run in any JavaScript environment — browser, Node.js terminal, and eventually React Native or web extensions — while preserving the gameplay, balance, and feel of the original.

## Goals

- Gameplay indistinguishable from the C version for the same seed
- Deterministic RNG with seed parity to the C implementation, enabling seed sharing, recordings, and cross-version validation
- Platform-agnostic game core with zero rendering or I/O dependencies
- Browser-first primary platform (Canvas2D renderer for the 100x34 character grid)
- Node.js terminal as secondary platform
- Readable, idiomatic TypeScript — not transliterated C
- Continuous validation via seed-based dungeon comparison against the C version

## Scope

What's in:
- All game logic from `src/brogue/` (~38K lines across 24 files)
- TypeScript platform interface mirroring the C `brogueConsole` struct
- Browser platform implementation (Canvas2D)
- Node.js terminal platform implementation
- Seed catalog regression testing
- Codebase manifest (`.context/manifest.yaml`) mapping C source structure

What's out:
- New gameplay features or balance changes — fidelity first
- React Native or web extension platforms (future initiatives)
- Changes to the C build system or C source code
- Graphical tile rendering (text mode first; tiles can come later)
- Multiplayer, networking, or server features

## Constraints

- AGPL-3.0 license must be preserved in all TypeScript source
- Deterministic RNG must produce identical output to the C PRNG for the same seeds
- Fixed-point arithmetic must be faithfully reproduced (BigInt for 64-bit precision)
- The C source in `src/brogue/` is the source of truth during porting — do not "improve" game logic
- This is a master initiative; actual implementation work happens in child initiatives per phase/module
