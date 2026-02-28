# Phase 4: Integration — Plan

## Approach

Phase 4 is organized into 5 steps that take the codebase from "ported but not compiling cleanly" to "playable and verified":

```
Step 1: Compile Clean     → Fix all 51 TS errors, clean exports, add missing flags
Step 2: Build & Launch    → Bundler setup, async boundary, title screen rendering
Step 3: Runtime Wiring    → Fill DI stubs, connect game loop end-to-end
Step 4: Verification      → Seed regression tests, recording playback, manual testing
Step 5: Terminal Platform → Node.js curses/ANSI renderer (secondary)
```

Steps 1–2 can be validated immediately (does it compile? does something render?). Step 3 is the bulk of the integration work. Step 4 proves correctness. Step 5 is additive.

---

## Step 1: Compile Clean

Fix all 51 pre-existing TypeScript errors. These fall into clear categories:

**Unused imports/variables (32 errors — TS6133, TS6196):**
Remove or prefix with `_`. Spread across io, items, menus, recordings, time modules. Mechanical fixes.

**Missing flag constants (6 errors — TS2339):**
- `T_DIVIDES_LEVEL` — used in `misc-helpers.ts`, needs adding to `TerrainFlag` in `types/flags.ts`
- `T_RESPIRATION_IMMUNITIES` — used in `creature-effects.ts`, composite flag needed
- `T_PATHING_BLOCKER` — used in `creature-effects.ts`, composite flag needed
- `xpxpThisTurn` — missing from creature effects context interface

**Missing/wrong exports (4 errors — TS2305, TS2724):**
- `recordings/index.ts` re-exports `playbackPanic`, `RecordingEventsContext` (don't exist), `RecordingInitContext` (wrong name)
- `io/index.ts` has `blendAppearances` name collision between sub-modules

**Type mismatches (9 errors — TS2322, TS2345, TS2353, TS2561, TS2367):**
- `WindowPos` uses `{window_x, window_y}` but code creates `{x, y}` — fix the object literals
- `colorDance` vs `colorDances` typo
- `DisplayGlyph` enum vs `0` literal
- `string` where `number` expected in `io-inventory.ts`
- Impossible comparison in `monster-actions.ts`

**Approach:** Fix in file-dependency order (types/flags → modules → barrel exports) so each fix reduces the error count monotonically.

---

## Step 2: Build & Launch

Get the browser build serving and rendering something on screen.

**Bundler setup:**
- Add Vite as dev dependency (fast, ESM-native, zero-config for TS)
- Configure `vite.config.ts` pointing at `index.html` as entry
- `npm run dev` should serve the game locally

**Async boundary resolution:**
The C codebase is fully synchronous — `pauseForMilliseconds` blocks, `nextKeyOrMouseEvent` blocks. In the browser, these must be async. The current runtime already returns `Promise`-based wrappers from `BrogueConsole`, but the call sites (deep in game logic) don't `await` them.

Options:
1. **Make the full call chain async** — `mainBrogueJunction`, `titleMenu`, `mainInputLoop`, etc. all become `async`. This is the most correct approach but requires touching many function signatures.
2. **Event-loop yielding with microtask scheduling** — Use a cooperative scheduler where blocking calls yield to the browser event loop via `await`. The game logic stays structurally synchronous but runs inside an async wrapper.
3. **Web Worker + SharedArrayBuffer** — Run game logic in a synchronous Worker, communicate with the main thread for rendering. Complex but preserves the C code's synchronous model exactly.

**Recommended:** Option 1 (async call chain). The DI context pattern already wraps all platform calls, so only the DI method signatures and their call sites need `async/await`. This is mechanical and the safest approach.

**Validation:** Title screen renders with animated flames, menu buttons appear and respond to clicks/keyboard.

---

## Step 3: Runtime Wiring

Fill the remaining TODO stubs in `runtime.ts` and connect the full game loop.

The runtime currently has ~11 TODO comments where DI context methods delegate to stub implementations. These need to be wired to the real module functions:

**Menu → Game Init flow:**
- `initializeRogue(seed)` → wire to `game/game-init.ts` with full `GameInitContext`
- `initializeGameVariant()` → wire variant-specific catalog switching
- `startLevel(depth, stairDirection)` → wire to `game/game-level.ts` with full `LevelContext`
- `mainInputLoop()` → wire to `io/io-input.ts` with full `InputContext`
- `freeEverything()` → wire to `game/game-cleanup.ts` with full `CleanupContext`

**Input → Game Logic flow:**
- Connect keystroke handlers to movement, inventory, combat actions
- Wire `displayLevel` to the full cell appearance + lighting pipeline
- Wire `refreshDungeonCell` to the display system

**Display pipeline:**
- `getCellAppearance` → full implementation with terrain layers, items, monsters, lighting
- `displayLevel` → iterate dungeon grid, compute appearance, write to display buffer, commit
- `commitDraws` → diff display buffer, flush changed cells to `BrogueConsole.plotChar`

**Approach:** Work through the game lifecycle in execution order:
1. Title menu (already mostly wired)
2. New game initialization
3. First level generation + display
4. Basic input handling (movement, stairs)
5. Turn processing + monster AI
6. Game over / victory

---

## Step 4: Verification

**Seed regression tests:**
- Port the existing Python test harness (`test/`) or create a new TS-based one
- Run both C and TS versions with the same seeds, compare dungeon layouts
- Start with the simplest comparison: RNG output for N calls after seeding
- Then compare: grid contents after `digDungeon`, monster placements, item placements

**Recording playback:**
- Load a C-generated `.broguerec` file
- Play it back in the TS version using the existing recording system
- Verify no OOS (out-of-sync) errors
- This is the strongest end-to-end correctness test: if playback works, the entire game logic chain matches

**Manual testing checklist:**
- [ ] Title screen renders with flame animation
- [ ] Menu buttons work (New Game, Open Game, View Recording, Quit)
- [ ] Variant selection works (Brogue, Rapid Brogue, Bullet Brogue)
- [ ] New game starts, dungeon renders
- [ ] Player can move (arrow keys, vi keys, numpad)
- [ ] Sidebar updates with visible entities
- [ ] Messages appear at top of screen
- [ ] Items can be picked up, dropped, equipped
- [ ] Combat works (hit a monster, take damage)
- [ ] Stairs work (descend to next level)
- [ ] Save game works
- [ ] Load saved game works
- [ ] Game over screen appears on death
- [ ] High scores display

---

## Step 5: Terminal Platform

Implement a Node.js terminal renderer as a secondary platform.

**Options:**
- Raw ANSI escape codes (no dependencies, maximum control)
- `blessed` / `blessed-contrib` (mature, feature-rich)
- `ink` (React-based, modern but may be overkill)

**Recommended:** Raw ANSI escape codes. The renderer only needs:
- `plotChar(glyph, x, y, fgR, fgG, fgB, bgR, bgG, bgB)` → ANSI 24-bit color + cursor positioning
- `nextKeyOrMouseEvent` → Node.js `readline` or raw stdin
- `pauseForMilliseconds` → `setTimeout`-based

This is a straightforward `BrogueConsole` implementation (~200 lines).

---

## Technical Notes

### Display Buffer Diffing

The current `commitDraws` implementation in `runtime.ts` uses `makeCommitDraws` which tracks a previous buffer and only calls `plotChar` for changed cells. This is already efficient for the Canvas2D renderer.

### State Reset Between Games

When the player dies and returns to the main menu, `freeEverything` must fully reset the game state. The current `CleanupContext` handles this, but the runtime needs to ensure all context references are updated (since some contexts hold direct references to arrays/objects that get replaced).

### Variant Switching

The runtime has a `setGameVariant` callback that needs to swap:
- `gameConst` (depths, item counts, etc.)
- Item tables (scrolls, potions, wands, staves, rings, charms)
- Bolt/DF catalogs
- Menu title text and level feelings
- Dynamic color bounds

This is partially wired but marked TODO for catalog switching.

---

## Open Questions

- **Vite vs esbuild:** Vite is recommended for DX (hot reload, etc.) but esbuild would also work for a simpler build. Decision: start with Vite, it's zero-config.
- **Async depth:** How deep does `async` need to go? The game loop calls `pauseBrogue` from within monster animation, color flash effects, etc. We may need most IO functions to be async. Need to audit the call graph.
- **Font for Canvas2D:** Currently using system monospace. Should we bundle a specific font for consistent glyph rendering across platforms?
- **Test seed catalog:** Which seeds should we use for regression? The C test suite may have a set. Need to check `test/` directory.
