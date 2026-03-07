# PLAN: port-v2-fix-rendering

## Session Protocol

**One sub-phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked task.
2. Complete that task only. Do not continue into the next task.
3. Commit. Update TASKS.md (check off completed tasks).
4. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-fix-rendering. Read: .context/PROJECT.md, initiatives/port-v2-fix-rendering/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact task name from TASKS.md]
   Branch: feat/port-v2-fix-rendering
   ```
   Add a `## Session Notes [date]` to PLAN.md only if there are decisions worth preserving.

Stop at 60% context. Do not start a new task to fill remaining context.

---

## Approach

Work phase-by-phase in fix-priority order. Each sub-phase ends with a commit. Do not start the
next sub-phase until the current one is committed and TASKS.md is updated.

The C source in `src/brogue/` is ground truth for all implementations. The audit gap files
(`docs/audit/gaps-*.md`) are the reference for what is missing and what is already stubbed.

---

## Phase 1 — Rendering blockers

**Files:** `rogue-ts/src/io/display.ts`, `rogue-ts/src/lifecycle.ts`

**Functions to implement:**
1. `getCellAppearance` (IO.c ~line 1) — computes the visual appearance of a dungeon cell. Inputs:
   grid coordinates + game state. Output: glyph, foreground color, background color. The C
   implementation handles terrain, items, monsters, lighting, and visibility state. This is the
   most complex function in Phase 1.
2. `refreshDungeonCell` (IO.c) — calls `getCellAppearance` then writes to the display buffer via
   `plotCharWithColor`. Wired into movement.ts and ui.ts contexts.
3. `displayLevel` (IO.c) — loops over all cells and calls `refreshDungeonCell`. Remove the stub
   in `lifecycle.ts:479` and add the real implementation. Add the test.skip to ui.test.ts or
   lifecycle.test.ts if not already present.

**Approach:** implement bottom-up: `getCellAppearance` first (domain logic, no side effects),
then `refreshDungeonCell` (calls getCellAppearance + plotCharWithColor), then `displayLevel`
(loops over map). Test each in isolation before wiring.

---

## Phase 2 — Runtime crash fix

**File:** `rogue-ts/src/lifecycle.ts` (game-lifecycle context builder)

**Problem:** `saveRecording` is declared in the context interface and called at
`game-lifecycle.ts:378` and `game-lifecycle.ts:596`, but no implementation is wired in. This
causes a runtime crash at game end.

**Fix:** Add a no-op stub `saveRecording: () => {}` to the context builder until the persistence
layer is built. Track it with a `test.skip`. Do not implement recording I/O — that is
OUT-OF-SCOPE.

---

## Phase 3 — Item system

**File:** `rogue-ts/src/items.ts` (and supporting files as needed)

**Reference:** `docs/audit/gaps-Items.md` — 28 MISSING + 12 STUBBED-UNTRACKED functions.

**Priority sub-order:**
1. `displayInventory` — inventory UI (blocks all item interaction)
2. `updateFloorItems` — per-turn item tick (fungal spread, etc.)
3. `itemIsCarried`, `itemQuantity` — utility functions used by use/drop flow
4. `identify` / `use` / `drop` flow functions
5. Individual item effects: `applyTunnelEffect`, `teleport`, `negationBlast`, `empowerMonster`,
   `magicChargeItem`, remaining potion/scroll/wand effects

**Note:** Each implemented function removes a `test.skip`. If a function requires a new helper,
add the helper in the same file (600-line limit applies — split if needed).

---

## Phase 4 — Monster AI

**File:** `rogue-ts/src/monsters.ts` (and supporting files as needed)

**Reference:** `docs/audit/gaps-Monsters.md` — 27 MISSING functions.

**Priority sub-order:**
1. `monsterCastSpell` — top-level spell dispatch
2. `monstUseBolt` — bolt-casting pipeline
3. Ability functions: `monstUseDomination`, `monstUseBeckon`, `monstUseBlinkAway`
4. Summon functions, polymorph, fear, confusion AI
5. `monsterDetails` — sidebar monster description

---

## Phase 5 — NEEDS-VERIFICATION review

**Reference:** `docs/audit/summary.md` — NEEDS-VERIFICATION table (139 functions).

**Approach:** Manual review, file by file. For each function: read C source, read TS port, note
any behavioral divergence. Fixes go into the appropriate source file. Divergences that are not
immediately fixable get a `test.skip` with a description.

**Priority:** Monsters.c (20 — highest risk of silent simplification) → PowerTables.c (15
unwired) → RogueMain.c (20) → rest.

---

## Rejected Approaches

- Implementing `saveRecording` with real file I/O: persistence layer is not planned — stub only.
- Batch-implementing all Items.c functions in one session: too large; sub-ordered for incremental progress.

## Open Questions

- ~~Does `getCellAppearance` require the lighting system to be fully functional first?~~ **RESOLVED:** `colorMultiplierFromDungeonLight` is already ported (io/color.ts). It reads `tmap[x][y].light[]`. If tmap is all-zeros the cell appears black — no blocker.
- Are any of the 15 unwired PowerTables.c functions reachable from current item code paths,
  or are they all blocked by MISSING Items.c functions?

---

## Session Notes 2026-03-06 — Phase 4b

### monstUseDomination / monstUseBeckon / monstUseBlinkAway — don't exist in C
These planned names were incorrect. The C code handles domination and beckoning as
bolt effects in the existing `monstUseBolt` pipeline (already ported in Phase 4a).
`monsterBlinkToSafety` and `monsterBlinkToPreferenceMap` exist but are STUBBED-UNTRACKED
(deferred — depend on `getSafetyMap` which requires safety-map computation).

### monsterDetails — implemented in two files (600-line split)
- `monsters/monster-details-helpers.ts` — `buildProperCommaString`, `monsterIsNegatable`,
  `getMonsterAbilitiesText`, `getMonsterDominationText`
- `monsters/monster-details.ts` — `MonsterDetailsContext`, `staffOrWandEffectOnMonsterDescription`,
  `summarizePack`, `monsterDetails`

`monsterDetails` is a standalone function. Wiring it into `SidebarContext.monsterDetails`
requires building the sidebar context (not done yet — `refreshSideBar` is still `() => {}`).
The wiring is tracked via `describe.skip` in `monster-details.test.ts`.

---

## Session Notes 2026-03-06 — Phase 1a

### getCellAppearance: inputs, output, branches

**Output** (matches existing context slot): `{ glyph: DisplayGlyph; foreColor: Color; backColor: Color }`

**Standalone function parameters** (for `io/cell-appearance.ts`):
```
loc: Pos
pmap: Pcell[][]
displayBuffer: ScreenDisplayBuffer       // needed for wall-top check: cell below
rogue: PlayerCharacter                   // playbackOmniscience, trueColorMode, inWater,
                                         // stealthRange, scentTurnNumber,
                                         // displayStealthRangeMode, cursorPathIntensity
player: Creature                         // loc, info.displayChar/foreColor, status[]
monsters: Creature[]                     // scan for monsterAtLoc
dormantMonsters: Creature[]              // scan for dormantMonsterAtLoc
floorItems: Item[]                       // scan for itemAtLoc
tileCatalog: readonly FloorTileType[]
dungeonFeatureCatalog: readonly DungeonFeature[]   // discoverType for secret tiles
monsterCatalog: readonly CreatureType[]            // hallucination random monster
terrainRandomValues: number[][][]        // bakeTerrainColors input
displayDetail: number[][]                // DisplayDetailValue for trueColor/stealth mode
scentMap: Grid                           // stealth range display
```

**Context slot** (already declared in effects.ts, targeting.ts, sidebar-player.ts, sidebar-monsters.ts):
```ts
getCellAppearance(loc: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color }
```
Wiring: standalone function wrapped in a closure capturing game state, injected via context builders.

**All dependencies already ported ✓:**
- Color ops: `applyColorMultiplier`, `applyColorAverage`, `applyColorAugment`, `normColor`,
  `separateColors`, `randomizeColor`, `swapColors`, `colorFromComponents`, `storeColorComponents`,
  `colorMultiplierFromDungeonLight` — all in io/color.ts
- Display: `glyphIsWallish`, `bakeTerrainColors`, `mapToWindowX/Y`, `randomAnimateMonster` — io/display.ts
- Items: `itemMagicPolarity`, `getItemCategoryGlyph`, `getHallucinatedItemCategory`, `itemAtLoc`
- Monsters: `monsterRevealed`, `monsterIsHidden`, `monsterHiddenBySubmersion`, `canSeeMonster`
  — exported from monsters/index.ts
- Scent: `scentDistance` — time/turn-processing.ts
- Color constants: all present in globals/colors.ts

**Logic branches (in order):**
1. **Stable memory path** — not visible/detected, monster not revealed → restore from `rememberedAppearance`; skip main loop
2. **Tile appearance loop** — default to FLOOR; determine `maxLayer` (0, LIQUID+1, or full) based on discovered/magic-mapped; loop layers skipping GAS; track bestPriority for fore/back/char
3. **Light multiplier** — `basicLightColor` (trueColor) or `colorMultiplierFromDungeonLight`
4. **Gas augment** — GAS layer backColor blended at `min(90, 30+volume)` weight
5. **Entity overlay** (in priority order):
   - HAS_PLAYER → player glyph/color; `needDistinctness = true`
   - Detected item (magic polarity, not visible) → G_AMULET/G_BAD_MAGIC/G_GOOD_MAGIC
   - Visible monster (or immobile+discovered) and not hidden → monster glyph/color; hallucination substitution; invisible ally transparency; ally pink tint
   - Monster revealed but not canSee → `'x'`/`'X'`, white; no light multiplier
   - HAS_ITEM (visible or discovered+non-moving terrain) → item glyph/color; remember item in pmap
   - Terrain only (visible or discovered) → clear pmap remembered item
   - Undiscovered → **early return** `{ ' ', black, undiscoveredColor }`
6. **Gas phantom silhouette** — invisible monster in gas cloud with gasAugment → show char in cellBackColor
7. **Memory store** — if cell is becoming stable memory: store colors, apply light → restore (so this frame and future frames match)
8. **Wall smoothing** — G_WALL/G_GRANITE + wallish cell below → G_WALL_TOP
9. **Visibility tinting** (mutually exclusive, checked in order):
   - Detected/revealed and not visible → no tint (leave as-is)
   - CLAIRVOYANT_VISIBLE (not VISIBLE) → clairvoyanceColor multiplier
   - TELEPATHIC_VISIBLE (not VISIBLE) → telepathyMultiplier
   - MAGIC_MAPPED only (not DISCOVERED) → magicMapColor
   - Not VISIBLE, not omniscience → memoryColor+memoryOverlay (or 80% black if inWater)
   - Omniscience (playerCanSeeOrSense but not ANY_KIND_OF_VISIBLE) → omniscienceColor
   - Fully visible → lightMultiplierColor; hallucination color randomization; deepWaterLightColor
10. **Path highlight** — IS_IN_PATH: swap colors (TM_INVERT) or average with yellow
11. **Stealth range** — IN_FIELD_OF_VIEW + scentDistance beyond 2×stealthRange → orange tint
12. **True color / stealth detail** — playerCanSeeOrSense: DV_DARK → purple-dark tint; DV_LIT → light augment
13. **separateColors** — if needDistinctness

**Key TS adaptation notes:**
- `playerCanSeeOrSense(x, y)` in C = `pmap[x][y].flags & ANY_KIND_OF_VISIBLE` — implement inline
- `assureCosmeticRNG`/`restoreRNG` — TS has no RNG-switching mechanism; use `randRange` directly (acceptable for cosmetic ops)
- `D_DISABLE_BACKGROUND_COLORS`, `D_SCENT_VISION` — debug macros always false; omit
- `monsterAtLoc`/`dormantMonsterAtLoc`/`itemAtLoc` — inline array scans
- `randomAnimateMonster` TS signature takes `(monsterFlags[], inanimate, invulnerable)` — call with monsterCatalog data

### File split required
`io/display.ts` is currently 484 lines. Adding getCellAppearance (~180 lines) + refreshDungeonCell + displayLevel would push it to ~674 lines — over the 600-line limit.

**Split plan:**
- New file `io/cell-appearance.ts` — `getCellAppearance`, `refreshDungeonCell`, `displayLevel`
- `io/display.ts` — unchanged (buffer ops, coordinate helpers, primitive draw functions)
