# Phase 0: Foundation — Plan

## Approach

Work bottom-up within this phase: project scaffolding first, then the manifest, then the type system, then math/RNG, then validation. Each step produces something testable before moving to the next.

---

## 1. Project Scaffolding

### Directory Structure

```
ts/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── types/           ← Rogue.h port: enums, interfaces, constants
│   │   ├── constants.ts
│   │   ├── enums.ts
│   │   ├── types.ts     ← structs → interfaces/types
│   │   ├── flags.ts     ← bitfield flag enums (Fl macro)
│   │   └── index.ts     ← barrel export
│   ├── math/            ← Math.c port: RNG, fixed-point, random utilities
│   │   ├── rng.ts       ← Jenkins PRNG, seedRandomGenerator, rand_range, etc.
│   │   ├── fixpt.ts     ← fixed-point arithmetic (fp_round, fp_pow, fp_sqrt)
│   │   ├── utils.ts     ← shuffleList, fillSequentialList, clamp, signum, etc.
│   │   └── index.ts
│   ├── utils/           ← Utilities.c helpers (endswith, append)
│   │   └── strings.ts
│   └── index.ts
└── tests/
    ├── rng.test.ts
    ├── fixpt.test.ts
    ├── utils.test.ts
    └── rng-validation.test.ts  ← cross-validation against C output
```

### Monorepo vs. Single Package

Start as a single package (`ts/`) at the repo root. This keeps things simple while we're in the foundation phase. If/when we add platform packages (browser, terminal), we can restructure into a monorepo using workspaces. Premature monorepo structure adds tooling overhead with no current benefit.

### Tooling

| Tool | Purpose |
|------|---------|
| TypeScript 5.x | Language |
| Vitest | Test runner (fast, ESM-native, watch mode) |
| tsconfig `strict: true` | Maximum type safety from the start |
| ESM modules | `"type": "module"` in package.json |

No bundler needed yet — we're not shipping to browsers in this phase.

---

## 2. Codebase Manifest

Create `.context/manifest.yaml` mapping all 24 C source files in `src/brogue/` with:
- File name and line count
- Primary responsibility
- Key types/functions defined
- Dependencies on other files
- Porting phase assignment

This is a reference artifact for all future phases — it makes it easy for any session to find the right C source and understand what depends on what.

---

## 3. Type System Port (Rogue.h → `src/types/`)

`Rogue.h` is 3,541 lines containing the entire type system. Port it as follows:

### Enums → TypeScript `enum` or `const enum`

The file contains ~60 C enums. Most map directly to TypeScript `enum`:

```typescript
// C: enum directions { NO_DIRECTION = -1, UP = 0, DOWN = 1, ... }
export enum Direction {
  NoDirection = -1,
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
  UpLeft = 4,
  DownLeft = 5,
  UpRight = 6,
  DownRight = 7,
}
```

**Naming convention:** PascalCase enum names, PascalCase members. Keep the mapping to C names traceable via comments.

### Bitfield Flag Enums → `number` with Fl() helper

Many C enums use `Fl(N)` for bitwise flags (e.g., `tileFlags`, `monsterBehaviorFlags`, `itemFlags`). These are used with bitwise `|`, `&`, `~` operators.

```typescript
export function Fl(n: number): number {
  return (1 << n) >>> 0; // unsigned 32-bit
}

// C: enum tileFlags { DISCOVERED = Fl(0), VISIBLE = Fl(1), ... }
export const TileFlags = {
  DISCOVERED: Fl(0),
  VISIBLE: Fl(1),
  HAS_PLAYER: Fl(2),
  // ...
} as const;
export type TileFlags = number; // used in bitwise expressions
```

Flags stay as plain `number` for efficient bitwise operations. We use `const` objects rather than TypeScript `enum` because TypeScript enums don't support bitwise combinations as values.

### Structs → TypeScript interfaces

```typescript
// C: typedef struct pos { short x; short y; } pos;
export interface Pos {
  x: number;
  y: number;
}

// C: typedef struct color { short red; short green; short blue; ... } color;
export interface Color {
  red: number;
  green: number;
  blue: number;
  redRand: number;
  greenRand: number;
  blueRand: number;
  rand: number;
  colorDances: boolean;
}
```

Larger structs (`creature`, `item`, `playerCharacter`) become interfaces. Linked list fields (`nextItem`, `nextCreature`) are replaced by arrays in the enclosing game state.

### Constants → `const` declarations

```typescript
export const COLS = 100;
export const MESSAGE_LINES = 3;
export const ROWS = 31 + MESSAGE_LINES; // 34
export const STAT_BAR_WIDTH = 20;
export const DCOLS = COLS - STAT_BAR_WIDTH - 1; // 79
export const DROWS = ROWS - MESSAGE_LINES - 2;  // 29
```

### Inline utility functions

`signum`, `clamp`, `min`, `max`, `coordinatesAreInMap`, `isPosInMap`, `mapToWindow`, `windowToMap` — port as pure functions in `src/types/` or `src/math/utils.ts`.

### What NOT to port here

- Function declarations at the bottom of `Rogue.h` (lines 2866–3537) — these are just forward declarations for functions defined in other `.c` files. They'll be ported when their respective modules are ported in later phases.
- `extern` global variable declarations — game state structure will be defined when needed.

---

## 4. Math/RNG Port (Math.c → `src/math/`)

### PRNG (Bob Jenkins' Small PRNG)

The core algorithm is ~20 lines of C. Key considerations for TypeScript:

```c
typedef uint32_t u4;
typedef struct ranctx { u4 a; u4 b; u4 c; u4 d; } ranctx;
#define rot(x,k) (((x)<<(k))|((x)>>(32-(k))))
static u4 ranval(ranctx *x) {
    u4 e = x->a - rot(x->b, 27);
    x->a = x->b ^ rot(x->c, 17);
    x->b = x->c + x->d;
    x->c = x->d + e;
    x->d = e + x->a;
    return x->d;
}
```

In TypeScript, all intermediate values must be forced to unsigned 32-bit using `>>> 0`. The `rot` function uses `>>> 0` to avoid sign extension.

Two independent RNG contexts are maintained: `RNG_SUBSTANTIVE` and `RNG_COSMETIC`. Both are seeded identically at game start but diverge during play.

### Seeding

`raninit` takes a `uint64_t` seed. In TypeScript, we'll accept `bigint` for the seed and extract the low 32 bits and high 32 bits:

```typescript
function raninit(ctx: RNGContext, seed: bigint): void {
  ctx.a = 0xf1ea5eed;
  ctx.b = ctx.c = ctx.d = Number(seed & 0xFFFFFFFFn) >>> 0;
  ctx.c ^= Number((seed >> 32n) & 0xFFFFFFFFn) >>> 0;
  for (let i = 0; i < 20; i++) ranval(ctx);
}
```

### rand_range and unbiased range

The `range(n, RNG)` function implements rejection sampling to avoid modular bias. Port faithfully.

### Fixed-Point Arithmetic

- `FP_BASE = 16` (16-bit fractional part)
- `FP_FACTOR = 1 << 16 = 65536`
- `fixpt` is `long long` (64-bit signed integer) in C

In TypeScript, use `bigint`:

```typescript
export type Fixpt = bigint;
export const FP_BASE = 16n;
export const FP_FACTOR = 1n << FP_BASE; // 65536n

export function fpMul(x: Fixpt, y: Fixpt): Fixpt {
  return (x * y) / FP_FACTOR;
}

export function fpDiv(x: Fixpt, y: Fixpt): Fixpt {
  return (x * FP_FACTOR) / y;
}
```

`fp_round`, `fp_pow`, `fp_sqrt` are each ~20-30 lines; port directly. `fp_sqrt` uses a lookup table (`SQUARE_ROOTS`) for small integers and bisection for larger values.

---

## 5. Validation Harness

### RNG Parity Test

1. Write a tiny C program that calls `seedRandomGenerator(seed)` and then calls `rand_range(0, 99)` 1000 times for several seeds, outputting the results.
2. Port the same sequence in TypeScript.
3. Compare outputs — they must be identical.

Alternatively: extract the expected RNG outputs from a C run as a JSON fixture, then test the TypeScript RNG against those fixtures. This avoids needing to compile C during testing.

### Fixed-Point Parity Test

For key functions (`fp_pow`, `fp_sqrt`), compute results for a range of inputs in C, save as fixtures, and compare against TypeScript output.

---

## Open Questions

- **Naming convention for ported types:** PascalCase TypeScript names vs. preserving C names for traceability? Current leaning: PascalCase for types/interfaces (TypeScript idiomatic), with C name in a comment. Keep flag constant names UPPER_SNAKE_CASE to match C, since they're referenced so heavily.
- **Fl() flags: `number` vs. `bigint`?** All existing flag enums fit within 31 bits (highest is `Fl(30)` in `monsterBehaviorFlags`). `number` is fine — using `>>> 0` for unsigned interpretation. One flag category (`tileFlags`) combines up to `Fl(30)`, still within 32-bit unsigned range.
- **Game state model:** How will the global `rogue`/`player`/`pmap` state be structured? Not needed for Phase 0 (just types), but worth thinking about. Leaning toward a `GameState` interface defined now, instantiated later.
