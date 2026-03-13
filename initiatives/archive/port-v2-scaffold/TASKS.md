# Port V2 — Scaffold — Tasks

## Phase 1: Project Setup
- [x] Create `rogue-ts/` folder at repo root
- [x] Copy and adapt `ts/package.json` → `rogue-ts/package.json` (adjust name, paths; removed vite/build:web since scaffold is library-only)
- [x] Copy and adapt `ts/tsconfig.json` → `rogue-ts/tsconfig.json` (removed DOM lib since no browser target yet)
- [x] Copy `ts/vitest.config.ts` → `rogue-ts/vitest.config.ts`
- [x] Run `npm install` in `rogue-ts/` and verify it succeeds

## Phase 2: Copy Reusable Modules
- [x] Copy `ts/src/types/` → `rogue-ts/src/types/`
- [x] Copy `ts/src/math/` → `rogue-ts/src/math/`
- [x] Copy `ts/src/globals/` → `rogue-ts/src/globals/`
- [x] Copy `ts/src/grid/` → `rogue-ts/src/grid/`
- [x] Copy `ts/src/dijkstra/` → `rogue-ts/src/dijkstra/`
- [x] Copy `ts/src/power/` → `rogue-ts/src/power/`
- [x] Copy `ts/src/state/` → `rogue-ts/src/state/`
- [x] Copy `ts/src/light/` → `rogue-ts/src/light/`
- [x] Copy `ts/src/architect/` → `rogue-ts/src/architect/`
- [x] Copy `ts/src/combat/` → `rogue-ts/src/combat/`
- [x] Copy `ts/src/game/` → `rogue-ts/src/game/`
- [x] Copy `ts/src/items/` → `rogue-ts/src/items/`
- [x] Copy `ts/src/monsters/` → `rogue-ts/src/monsters/`
- [x] Copy `ts/src/movement/` → `rogue-ts/src/movement/`
- [x] Copy `ts/src/time/` → `rogue-ts/src/time/`

## Phase 3: Verify Compilation
- [x] Run `npm run build` (or `tsc --noEmit`) in `rogue-ts/` — must produce 0 errors
- [x] If compilation errors exist, fix them one file at a time before continuing — **no errors; all files compiled as-is**
- [x] Note any files that required modification — **none required modification**

## Phase 4: Copy and Verify Tests
- [x] Copy all test files from `ts/` that test only the copied modules (not runtime.ts)
- [x] Identify and exclude any tests that import from `runtime.ts` — `debug-player-placement.test.ts` excluded; needs integration test in port-v2-wiring
- [x] Excluded platform/IO directories: `tests/io/`, `tests/menus/`, `tests/recordings/` — belong in port-v2-platform
- [x] Run test suite — **47 test files, 1457 tests, all passing**

## Completion
- [x] 0 compilation errors
- [x] All copied unit tests passing (1457/1457)
- [ ] No file in `rogue-ts/src/` exceeds 600 lines — **DEFERRED: 29 files exceed 600 lines, all inherited from first attempt. Data catalogs cannot be split; logic files flagged for splitting in port-v2-wiring. See PLAN.md for full list.**
- [x] `rogue-ts/` committed to git with message "feat: port-v2 scaffold — reusable modules copied and verified"

## Notes for port-v2-wiring
- `debug-player-placement.test.ts` needs to be rewritten as integration test once wiring layer exists
- 26 logic files over 600 lines need splitting — PLAN.md has the full list with sizes
- No stub files introduced during scaffold; any stubs present are inherited and already tracked

---

> CLOSED — all phases complete. Archived by port-v2-close-out Phase 1a.
