# Port V2 — Scaffold

## Intent
Create the `rogue-ts/` project folder, copy all reusable files from the first attempt, and establish a clean, compiling baseline before any new wiring work begins.

## Goals
- `rogue-ts/` exists with correct TypeScript project setup (tsconfig, package.json, test runner)
- All 82 reusable files are copied and compile without errors
- The 5 files needing minor adaptation are adapted and compile
- All existing unit tests that came with those modules pass in the new context
- No `runtime.ts` or equivalent monolith exists yet — that is the next initiative

## Scope
What's in:
- New `rogue-ts/` folder structure mirroring the module layout of the first attempt
- TypeScript and test tooling setup (copy from `ts/`, adjust paths)
- Copy of all REUSE-AS-IS files (see PORT_V2.md for the full list)
- Minor adaptation of the 5 REUSE-WITH-MODS files (combat-attack, combat-math, combat-runics, item-ops, monster-ops)
- Verification that the copied test suite passes

What's out:
- Any wiring/context builder code — that is port-v2-wiring
- Any IO, UI, or platform code — that is port-v2-platform
- The main game loop or entry point

## Constraints
- No file may be created that exceeds 600 lines
- The scaffold produces no running game — just a compiling module library with passing unit tests
