# TypeScript Port — Plan

## Approach

The port follows a phased, bottom-up strategy: start with the foundations that everything depends on (types, RNG, math), then build up through data catalogs, core game systems, UI, and finally platform integration. Each phase is tracked as a child initiative under this master initiative.

The C source in `src/brogue/` is the source of truth. Every module is ported to produce identical behavior for the same inputs. Seed-based validation (same seed → same dungeon) is the primary verification method.

### Phase Overview

```
Phase 0: Foundation        → Types, RNG, fixed-point math, project scaffolding
Phase 1: Data Layer        → Static catalogs, grid operations, power tables
Phase 2: Core Systems      → Game logic modules (9 files, ~27K lines)
Phase 3: UI & Platform     → In-game UI, menus, browser renderer, game loop
Phase 4: Integration       → Full game, regression tests, terminal platform
```

Each phase produces a working, testable artifact. No phase requires the one after it.

---

## Phase Details

### Phase 0 — Foundation

**Child initiative:** `port-phase-0-foundation`

Deliverables:
- TypeScript project structure (package.json, tsconfig, test framework)
- Codebase manifest (`.context/manifest.yaml`) mapping all C source files
- Port of `Rogue.h` type system: all enums, structs, constants, typedefs → TypeScript interfaces, enums, type aliases, and constants
- Port of `Math.c`: deterministic PRNG (Bob Jenkins' small PRNG), fixed-point arithmetic (`fixpt`, `FP_MUL`, `FP_DIV`, `fp_pow`, `fp_sqrt`), `rand_range`, `rand_percent`, `shuffleList`
- Validation harness: confirm TypeScript RNG produces identical output to C RNG for test seeds

Why this is first: every other file in the codebase depends on `Rogue.h` types and `Math.c` functions. Nothing else can be ported without these.

### Phase 1 — Data Layer

**Child initiative:** `port-phase-1-data-layer`

Deliverables:
- `GlobalsBase.c` (123 lines): base global variable definitions, direction tables, map accessors
- `Globals.c` (1,821 lines): monster catalog, item tables, terrain definitions, color tables, bolt catalog, dungeon feature catalog, horde catalog, blueprint catalog
- `PowerTables.c` (345 lines): pre-computed power/enchantment lookup tables
- `Grid.c` (547 lines): grid allocation, fill, copy, flood fill, rectangle/circle drawing, blob generation

Why this is second: the data catalogs are needed by virtually every game system. Grid operations are used by dungeon generation, pathfinding, lighting, and movement.

### Phase 2 — Core Systems

Each module may be its own child initiative. Recommended porting order (based on dependencies — simpler/smaller modules first):

1. **Dijkstra** (`port-core-dijkstra`, 259 lines) — pathfinding algorithm. Used by movement, monsters, and dungeon generation.
2. **Light** (`port-core-light`, 412 lines) — lighting calculations, FOV, flares. Relatively self-contained.
3. **Combat** (`port-core-combat`, 1,784 lines) — attack resolution, damage, bolts, death. Depends on items and monsters but has a clear API surface.
4. **Movement** (`port-core-movement`, 2,487 lines) — player and monster movement, pathfinding integration, travel system.
5. **Items** (`port-core-items`, 8,040 lines) — item generation, identification, enchantment, usage. The largest single file. Consider splitting into sub-modules.
6. **Monsters** (`port-core-monsters`, 4,826 lines) — monster AI, spawning, behavior, abilities. Heavily interconnected with combat and movement.
7. **Architect** (`port-core-architect`, 3,837 lines) — dungeon level generation, room attachment, machine placement. Key validation target: same seed → same dungeon layout.
8. **Time** (`port-core-time`, 2,640 lines) — turn processing, status effect ticking, environment updates. Depends on most other systems.
9. **Recordings** (`port-core-recordings`, 1,519 lines) — game recording and playback. Depends on the event system and RNG.

### Phase 3 — UI & Platform

Child initiatives:
- **`port-ui-io`** (5,128 lines) — all in-game UI: messages, sidebar, inventory, targeting, color rendering, text display
- **`port-ui-menus`** (2,176 lines combined) — Buttons.c (368), MainMenu.c (1,286), Wizard.c (522)
- **`port-platform-browser`** — Canvas2D renderer for the 100×34 character grid, keyboard/mouse input handling
- **`port-game-loop`** (1,414 lines) — RogueMain.c: game initialization, save/load, victory/death, game loop orchestration

### Phase 4 — Integration

**Child initiative:** `port-integration`

Deliverables:
- Full game loop running in a browser
- Seed catalog regression tests (port of existing Python tests in `test/`)
- Node.js terminal platform (secondary)
- Performance profiling and optimization
- Save/load interoperability testing

---

## Technical Strategy

### Global State

The C codebase uses a flat global state model: `rogue` (playerCharacter), `pmap`/`tmap` (dungeon grids), `player` (creature), `monsters`/`dormantMonsters` (creature lists), `floorItems`/`packItems` (item lists).

In TypeScript, these will be encapsulated in a `GameState` class or plain object. Functions that implicitly read/write globals in C will receive the state as a parameter or operate as methods on the state object. The exact pattern will be decided in Phase 0.

### C Idioms → TypeScript

| C Pattern | TypeScript Equivalent |
|-----------|----------------------|
| `typedef long long fixpt` with `FP_BASE 16` | `bigint` with `FP_BASE = 16n`, or `number` if values stay within safe integer range |
| `Fl(N)` bitfield flags (`unsigned long`) | `number` with bitwise ops, or `Set<EnumValue>` for readability |
| `boolean` as `char` | Native `boolean` |
| Linked lists (`nextItem`, `nextCreature`) | Arrays or typed linked list classes |
| `char*` string manipulation (`sprintf`, `strcat`) | Template literals, string concatenation |
| `short **` 2D grids | `number[][]` or `Int16Array` flat buffers |
| `memset`/`memcpy` | Object spread, `Array.fill()`, structured clone |
| `malloc`/`free` | Garbage collection; just `new`/let go |

### Deterministic RNG

The PRNG in `Math.c` (Bob Jenkins' small PRNG) uses 32-bit unsigned integer arithmetic with overflow. In TypeScript:
- Use `>>> 0` to force unsigned 32-bit wrap-around
- Or use `Uint32Array` views for intermediate calculations
- The algorithm is ~30 lines; faithful porting is straightforward

Two RNG streams are maintained: `RNG_SUBSTANTIVE` (affects gameplay) and `RNG_COSMETIC` (visual-only randomness). Both must be preserved.

### Fixed-Point Arithmetic

`fixpt` is `long long` (64-bit) with 16-bit fractional part. Options:
- `BigInt` — faithful to C behavior, no precision concerns, but slower
- `number` — JavaScript's 53-bit mantissa covers most use cases, but risks subtle precision bugs in edge cases

Decision: start with `BigInt` for correctness, profile later, and optimize to `number` only where validated safe.

### Testing Approach

1. **Unit tests per module**: port a C function, write a test that feeds the same inputs and expects the same outputs.
2. **Seed validation**: for RNG and dungeon generation, run the C version and TypeScript version with the same seed and compare outputs.
3. **Seed catalog regression**: the existing `test/` directory has Python scripts that compare dungeon output by seed. Port this to work with the TypeScript version.
4. **Recording playback**: once recordings work, play back C-generated recordings in the TypeScript version and verify no OOS (out-of-sync) errors.

---

## Open Questions

- **Module structure:** mirror C files 1:1 in TypeScript (e.g., `items.ts`, `monsters.ts`) or rearchitect into sub-packages (e.g., `dungeon/`, `combat/`, `entities/`)? Leaning toward 1:1 initially to keep the mapping traceable, then refactor after the port is validated.
- **Monorepo or single package?** A monorepo (`packages/core`, `packages/browser`, `packages/terminal`) would be cleaner for multi-platform, but adds tooling overhead. Single package with conditional imports may suffice initially.
- **Build tooling:** Vite? esbuild? tsc only? Depends on whether we need bundling for the browser target during development.
- **Terminal library:** For the Node.js platform — blessed, ink, raw ANSI, or something else?
