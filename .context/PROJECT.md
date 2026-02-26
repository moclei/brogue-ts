# brogue-ts — TypeScript Port of Brogue: Community Edition

> **Quick Reference**: See [WORKFLOW.md](./WORKFLOW.md) for initiative documentation conventions and AI agent instructions.

## Purpose

This project is a TypeScript port of [Brogue: Community Edition](https://github.com/tmewett/BrogueCE) (v1.15.1), a single-player roguelike dungeon crawler originally written in C by Brian Walker and maintained by the community.

The goal is to produce a faithful, idiomatic TypeScript implementation of Brogue that can run in any JavaScript environment — browser, Node.js terminal, React Native, web extensions — while preserving the gameplay, balance, and feel of the original.

**Why port to TypeScript?**

- **Reach:** Run the game anywhere JavaScript runs — browsers, terminals, mobile apps, extensions — from a single codebase.
- **Accessibility:** TypeScript is far more widely known than C. A TS codebase lowers the barrier for contributors and modders.
- **Ecosystem:** Leverage the JavaScript ecosystem for rendering, tooling, packaging, and distribution.

**Owner:** Marc Ó Cleirigh

---

## What This Project Is

A fork of BrogueCE that retains the original C source as a reference while building a TypeScript port alongside it. The C code is the source of truth for game logic, balance, and behavior during porting. Once the port is complete and validated, the C code may be archived or removed.

## What This PROJECT.md File Is Not

- Not a task tracker — active work is tracked in `initiatives/` per the [WORKFLOW.md](./WORKFLOW.md) conventions
- Not a porting guide or tutorial — technical plans live in initiative PLAN.md files
- Not a design document for new features — the port aims for fidelity first, divergence later

---

## Original C Architecture

The upstream BrogueCE codebase is ~49,000 lines of pure C (not C++), cleanly separated into three layers:

### Game Logic — `src/brogue/` (~42K lines)

The core engine. All dungeon generation, combat, items, monsters, movement, lighting, and UI logic lives here. Key files by size and responsibility:

| File | Lines | Responsibility |
|------|-------|----------------|
| `Items.c` | 8,040 | Item generation, identification, enchantment, usage |
| `IO.c` | 5,128 | All in-game UI: messages, sidebar, inventory, targeting |
| `Monsters.c` | 4,826 | Monster AI, spawning, behavior, abilities |
| `Architect.c` | 3,837 | Dungeon level generation and "machine" placement |
| `Rogue.h` | 3,540 | Master header: all types, enums, constants, struct definitions |
| `Time.c` | 2,640 | Turn processing, status effects, environment updates |
| `Movement.c` | 2,487 | Player and monster movement, pathfinding |
| `Combat.c` | 1,784 | Attack resolution, damage, death |
| `Globals.c` | 1,821 | Monster/item/terrain catalog data tables |
| `RogueMain.c` | 1,414 | Game loop, save/load, new game initialization |
| `Recordings.c` | 1,519 | Game recording and playback system |
| `MainMenu.c` | 1,286 | Title screen, menu navigation |

### Platform Layer — `src/platform/` (~5.5K lines)

Abstraction layer that separates game logic from I/O. The key interface is the `brogueConsole` struct in `platform.h`:

```c
struct brogueConsole {
    void (*gameLoop)();
    boolean (*pauseForMilliseconds)(short milliseconds, PauseBehavior behavior);
    void (*nextKeyOrMouseEvent)(rogueEvent *returnEvent, boolean textInput, boolean colorsDance);
    void (*plotChar)(enum displayGlyph inputChar, short x, short y,
                     short foreRed, short foreGreen, short foreBlue,
                     short backRed, short backGreen, short backBlue);
    void (*remap)(const char *, const char *);
    boolean (*modifierHeld)(int modifier);
    void (*notifyEvent)(short eventId, int data1, int data2, const char *str1, const char *str2);
    boolean (*takeScreenshot)();
    enum graphicsModes (*setGraphicsMode)(enum graphicsModes mode);
};
```

Platform backends:
- **`sdl2-platform.c`** — Graphical rendering via SDL2 (primary desktop experience)
- **`curses-platform.c`** — Terminal rendering via ncurses
- **`web-platform.c`** — Web rendering via Unix socket IPC (used by web-brogue server)
- **`null-platform.c`** — Headless mode for testing and seed catalogs
- **`term.c` / `tiles.c`** — Shared terminal and tile rendering utilities

### Variants — `src/variants/` (~1.9K lines)

Game constant overrides for alternate game modes (Rapid Brogue, Bullet Brogue). Each variant defines its own `gameConstants` struct.

### Core Data Structures

All defined in `Rogue.h`:

- **`playerCharacter`** — Global game state: depth, gold, seed, equipment, maps, recording state, ring bonuses, etc.
- **`creature`** — Any living entity (player and monsters alike): HP, position, AI state, status effects, absorption
- **`item`** — Weapons, armor, potions, scrolls, etc.: category, enchantment, charges, position
- **`pcell`** — Permanent dungeon cell: terrain layers, flags, remembered appearance
- **`levelData`** — Stored level state for revisiting: map, items, monsters, seed
- **`creatureType` / `itemTable`** — Catalog entries defining base stats for all monster and item types

### Notable C Patterns

These patterns will need deliberate handling during porting:

- **Global mutable state:** The `rogue` global holds nearly all game state. Many functions read/write it implicitly.
- **Bitfield flags:** Extensive use of `unsigned long` with `Fl(N)` macro for bitwise flag operations.
- **Fixed-point arithmetic:** `typedef long long fixpt` with 16-bit fractional part (`FP_BASE 16`). Used for damage scaling, power calculations, etc.
- **Linked lists:** Creatures and items stored as manually-managed linked lists (`nextItem`, `nextCreature`).
- **Large data catalogs:** Monster catalog, item tables, terrain definitions, bolt types — thousands of lines of static data.
- **Deterministic RNG:** Seeded random number generation enables reproducible dungeons and recording/playback.

### Rendering Model

The game renders to a **100-column by 34-row character grid** (`COLS=100`, `ROWS=34`). Each cell has:
- A Unicode display glyph
- Foreground RGB color (0-100 scale)
- Background RGB color (0-100 scale)

The dungeon viewport is 79x29 within this grid (sidebar takes 20 columns + 1 separator, messages take 3 rows + 2 for flavor/menu). Optional graphical tiles can overlay the text characters.

This grid-based model is excellent for porting — any platform that can draw colored characters in a grid can render Brogue.

---

## Repository Structure

```
BrogueCE/
├── .context/
│   ├── PROJECT.md              ← You are here. Static project context.
│   └── WORKFLOW.md             ← Initiative conventions & AI instructions
├── initiatives/                ← Per-feature development docs (created as needed)
├── src/
│   ├── brogue/                 ← Original C game engine (reference during porting)
│   │   ├── Rogue.h             ← Master header: types, enums, constants
│   │   ├── Architect.c         ← Dungeon generation
│   │   ├── Combat.c            ← Attack resolution
│   │   ├── IO.c                ← In-game UI
│   │   ├── Items.c             ← Item system
│   │   ├── Monsters.c          ← Monster AI
│   │   ├── Movement.c          ← Pathfinding and movement
│   │   ├── RogueMain.c         ← Game loop
│   │   └── ...                 ← (24 files total)
│   ├── platform/               ← C platform backends (SDL2, curses, web, null)
│   └── variants/               ← Game variant constants
├── bin/assets/                 ← Game assets (tiles, icons)
├── test/                       ← Seed catalog regression tests (Python)
├── Makefile                    ← C build system
├── config.mk                  ← Build configuration
├── BUILD.md                    ← C build instructions
└── README.md                   ← Upstream project README
```

> **TypeScript source** will be added under a new top-level directory (e.g. `ts/` or `packages/`) — structure to be determined in the first initiative.

---

## Target Platforms

The TypeScript port should support multiple rendering backends behind an interface equivalent to the C `brogueConsole`:

| Platform | Rendering Approach | Priority |
|----------|-------------------|----------|
| Browser | Canvas2D or WebGL for the character grid | Primary |
| Node.js terminal | Terminal library (e.g. blessed, ink, or raw ANSI) | Primary |
| React Native | Custom view or canvas equivalent | Future |
| Web extension | Embedded browser rendering | Future |

The platform interface in TypeScript will mirror `brogueConsole`: a contract for drawing glyphs, receiving input events, and controlling timing.

---

## Key Porting Considerations

### What Makes This Tractable

- **Clean platform abstraction.** The `brogueConsole` interface is small and well-defined. It maps directly to a TypeScript interface. Game logic never touches platform code directly.
- **Grid-based rendering.** The entire display is a fixed-size character grid with colors. No complex graphics pipeline — any environment that can draw colored text in a grid works.
- **No external dependencies.** The game logic uses only C stdlib. No third-party libraries to deal with.
- **Deterministic gameplay.** Seeded RNG means we can generate the same dungeons in both C and TypeScript, enabling direct comparison for validation.
- **Existing web platform.** `web-platform.c` proves the game already functions with a socket-based web frontend, validating the concept of non-native rendering.

### Challenges

- **Scale.** ~42,000 lines of game logic is substantial. This is not a weekend project.
- **Global state.** The `rogue` global and other module-level state need careful restructuring for TypeScript (likely a game state object passed explicitly or encapsulated in a class).
- **C idioms.** Pointer arithmetic, manual memory management, `char*` string manipulation, and bitwise flag operations all need idiomatic TypeScript equivalents.
- **Fixed-point math.** The fixed-point system (`fixpt` type, `FP_MUL`, `FP_DIV`) is used throughout power calculations. Needs faithful reimplementation or conversion to floating-point with validation.
- **Data tables.** Thousands of lines of monster/item/terrain catalog data need to be ported. Tedious but mechanical.
- **Validation.** Ensuring behavioral fidelity with the C version requires systematic testing, likely using seed-based dungeon comparison.

---

## Open Questions

These are unresolved decisions that should be explored early, likely in the first initiative(s):

1. **Porting strategy:** Incremental (port one module at a time, bridging with C) vs. full rewrite (port everything, validate at the end)? Emscripten/WASM as a reference or stepping stone?
2. **Module structure:** Mirror the C file layout (one TS module per C file) or rearchitect into a more idiomatic structure (e.g. separate `dungeon/`, `combat/`, `ui/` packages)?
3. **State management:** How to handle the global `rogue` state — singleton class, context object, or something else?
4. **Rendering libraries:** Canvas2D vs. WebGL for browser? Which terminal library for Node? Build our own thin layer or use an existing roguelike rendering library?
5. **Validation approach:** How to systematically verify the port produces identical gameplay? Seed catalog comparison? Turn-by-turn replay matching?
6. **Build and packaging:** Monorepo with shared core + per-platform packages? Single package with conditional imports?

---

## Upstream Reference

| Resource | URL |
|----------|-----|
| BrogueCE GitHub | [github.com/tmewett/BrogueCE](https://github.com/tmewett/BrogueCE) |
| Brogue Wiki | [brogue.fandom.com](https://brogue.fandom.com/wiki/Brogue_Wiki) |
| Brogue Reddit | [r/brogueforum](https://www.reddit.com/r/brogueforum/) |
| Original Brogue | [sites.google.com/site/broguegame](https://sites.google.com/site/broguegame/) |
| License | AGPL-3.0 (must be preserved in the TypeScript port) |

---

## Principles

1. **Fidelity first.** The port should produce gameplay indistinguishable from the C version. Get it right before making it different.
2. **Platform-agnostic core.** Game logic must have zero rendering or I/O dependencies. The platform interface is the only boundary.
3. **Validate continuously.** Use seed-based testing to catch behavioral divergence early and often.
4. **Port, don't redesign.** Resist the urge to "improve" game logic during porting. Faithful first, refactored second, redesigned never (unless in a separate initiative).
5. **Readable TypeScript.** The port should feel like idiomatic TypeScript, not transliterated C. Use classes, enums, typed arrays, and proper error handling — but keep the mapping to the original traceable.
6. **Check initiatives first.** Before starting work, read the relevant initiative's BRIEF.md, PLAN.md, and TASKS.md in `initiatives/`. If none exist, ask whether the current task should be managed as an initiative.

---

*Static context document. Update when the project's scope, architecture, or key decisions change materially.*
