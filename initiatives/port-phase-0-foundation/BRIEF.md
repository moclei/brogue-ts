# Phase 0: Foundation

## Intent

Establish the TypeScript project scaffolding, port the foundational type system (`Rogue.h`) and math primitives (`Math.c`), and build a validation harness to confirm deterministic parity with the C implementation. This is the bedrock that every subsequent phase depends on.

## Goals

- Working TypeScript project with build, lint, and test tooling
- Codebase manifest (`.context/manifest.yaml`) mapping all C source files by responsibility
- All enums, constants, type aliases, interfaces, and structs from `Rogue.h` ported to idiomatic TypeScript
- Deterministic PRNG (Bob Jenkins' small PRNG) producing identical output to the C version for any seed
- Fixed-point arithmetic (`fixpt`, `FP_MUL`, `FP_DIV`, `fp_round`, `fp_pow`, `fp_sqrt`) faithfully reproduced
- Utility functions (`rand_range`, `rand_percent`, `shuffleList`, `fillSequentialList`, `randClumpedRange`) ported and tested
- Validation harness confirming RNG parity across a set of test seeds

## Scope

What's in:
- TypeScript project setup (monorepo structure, `package.json`, `tsconfig.json`, Vitest)
- `.context/manifest.yaml` — structured map of all 24 C source files
- Port of `Rogue.h`: ~60 enums, ~30 structs/typedefs, ~200 constants, inline utility functions
- Port of `Math.c` (289 lines): PRNG, fixed-point math, random utilities
- Port of `Utilities.c` string helpers referenced from `Rogue.h` (`endswith`, `append`)
- Unit tests for all ported math/RNG functions
- C-vs-TypeScript RNG validation harness

What's out:
- Data catalogs (`Globals.c`, `GlobalsBase.c`, `PowerTables.c`) — that's Phase 1
- Grid operations (`Grid.c`) — that's Phase 1
- Any game logic beyond math primitives
- Platform or rendering code
- Browser or Node.js platform implementations

## Constraints

- AGPL-3.0 license header on all TypeScript source files
- PRNG must use `>>> 0` or `Uint32Array` to replicate C unsigned 32-bit overflow behavior
- Fixed-point arithmetic starts with `bigint` for correctness; optimize later only where validated safe
- The `Fl(N)` bitfield macro maps to `(1 >>> 0) << N` — must stay as `number` bitwise ops (not `BigInt`) since flags fit in 32 bits
- No game logic changes — port `Rogue.h` definitions exactly as they are in C v1.15.1
