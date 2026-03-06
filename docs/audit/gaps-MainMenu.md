# Audit: MainMenu.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured 18 static functions. Supplemented with a public-function
grep pass to find 4 additional functions (`quitImmediately`, `dialogAlert`, `dialogChooseFile`,
`mainBrogueJunction`). Total: 24 functions. TASKS.md estimated ~22 — minor undercount due to
`stringsExactlyMatch` and `fileEntryCompareDates` not being listed in the original estimate.

MainMenu.c is the main menu and game-launch orchestration file. It contains the flame animation
system (`drawMenuFlames`, `updateMenuFlames`, `antiAlias`, `initializeMenuFlames`), the button/menu
initialization helpers, the title-screen event loop (`titleMenu`), the top-level game junction
(`mainBrogueJunction`), game-mode/variant selection dialogs, and file/stats utilities
(`dialogChooseFile`, `viewGameStats`, `addRuntoGameStats`).

In the TS port, this file's responsibilities are split across three modules:
- `menus/menu-flames.ts` — flame animation (drawMenuFlames, updateMenuFlames, antiAlias, initializeMenuFlames)
- `menus/menu-buttons.ts` — button init helpers (initializeMainMenuButton, stackButtons, initializeMenu)
- `menus/main-menu.ts` — title loop and top-level junction (initializeMainMenuButtons, initializeMainMenu,
  initializeFlyoutMenu, isFlyoutActive, getNextGameButtonPos, redrawMainMenuButtons, titleMenu, mainBrogueJunction)
- `menus/character-select.ts` — game mode selection and file/stats utils (chooseGameVariant, chooseGameMode,
  dialogAlert, quitImmediately, dialogChooseFile, addRunToGameStats, viewGameStats)

**Coverage is high** — 22 of 24 C functions have real TS implementations. The 2 MISSING entries are
private static C helpers (`stringsExactlyMatch`, `fileEntryCompareDates`) whose logic is inlined
into `dialogChooseFile` using JS idioms (`.endsWith()`, `.sort()`). No gameplay logic is absent.

Notable platform dependency: three wiring context slots in `menus.ts` that affect menu functions
are currently no-op stubs with no test.skip tracking:
- `listFiles: () => []` — makes `dialogChooseFile` always show "No applicable files found."
- `loadRunHistory: () => []` — makes `viewGameStats` always show empty stats.
- `saveResetRun: () => {}` — save-reset marker write silently dropped.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| drawMenuFlames | 42 | menus/menu-flames.ts:254 | NEEDS-VERIFICATION | Real impl; no direct test |
| updateMenuFlames | 84 | menus/menu-flames.ts:188 | IMPLEMENTED | 1 test in menus.test.ts:21 verifying flame values advance from source |
| antiAlias | 161 | menus/menu-flames.ts:98 | NEEDS-VERIFICATION | Real impl; no direct test |
| initializeMenuFlames | 185 | menus/menu-flames.ts:128 | NEEDS-VERIFICATION | Real impl; no direct test |
| initializeMainMenuButton | 256 | menus/menu-buttons.ts:30 | NEEDS-VERIFICATION | Real impl; no direct test |
| initializeMainMenuButtons | 275 | menus/main-menu.ts:46 | NEEDS-VERIFICATION | Real impl; no direct test |
| stackButtons | 295 | menus/menu-buttons.ts:59 | NEEDS-VERIFICATION | Real impl; no direct test |
| initializeMenu | 319 | menus/menu-buttons.ts:93 | NEEDS-VERIFICATION | Real impl; no direct test |
| initializeMainMenu | 351 | menus/main-menu.ts:71 | NEEDS-VERIFICATION | Real impl; no direct test |
| initializeFlyoutMenu | 363 | menus/main-menu.ts:92 | NEEDS-VERIFICATION | Real impl; no direct test |
| chooseGameVariant | 390 | menus/character-select.ts:42 | NEEDS-VERIFICATION | Real impl; no direct test |
| chooseGameMode | 430 | menus/character-select.ts:85 | NEEDS-VERIFICATION | Real impl; no direct test |
| isFlyoutActive | 471 | menus/main-menu.ts:130 | NEEDS-VERIFICATION | Simple predicate; real impl; no direct test |
| getNextGameButtonPos | 479 | menus/main-menu.ts:143 | NEEDS-VERIFICATION | Real impl; no direct test |
| redrawMainMenuButtons | 491 | menus/main-menu.ts:165 | NEEDS-VERIFICATION | Real impl; no direct test |
| quitImmediately | 624 | menus/character-select.ts:159 | NEEDS-VERIFICATION | Real impl; no direct test |
| titleMenu | 507 | menus/main-menu.ts:192 | NEEDS-VERIFICATION | Real impl; main menu event loop; no direct test |
| stringsExactlyMatch | 652 | — | MISSING | Private static C helper; logic inlined into dialogChooseFile as .endsWith() |
| fileEntryCompareDates | 667 | — | MISSING | Private static C helper; logic inlined into dialogChooseFile as .sort() |
| addRuntoGameStats | 891 | menus/character-select.ts:351 | IMPLEMENTED | 3 tests in menus.test.ts:44–103 (accumulation, streak reset, reset marker) |
| viewGameStats | 938 | menus/character-select.ts:393 | NEEDS-VERIFICATION | Real impl; always shows empty stats in practice because ctx.loadRunHistory() is `() => []` stub; no direct test |
| dialogAlert | 640 | menus/character-select.ts:131 | NEEDS-VERIFICATION | Real impl; no direct test |
| dialogChooseFile | 690 | menus/character-select.ts:181 | NEEDS-VERIFICATION | Real impl; always returns null because ctx.listFiles() is `() => []` stub; no direct test |
| mainBrogueJunction | 1101 | menus/main-menu.ts:311 | NEEDS-VERIFICATION | Top-level game junction; real impl; no direct test |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 2 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 2 |
| NEEDS-VERIFICATION | 20 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **24** |

## Critical Gaps

No MISSING functions represent gameplay logic gaps. The 2 MISSING entries are internal C helpers
whose logic is absorbed inline.

No STUBBED-UNTRACKED domain functions.

The most significant gaps are platform-dependency wiring stubs that silently degrade key menu
functions. Ordered by playtest impact:

1. `ctx.listFiles: () => []` (menus.ts:261) — **untracked wiring stub** — `dialogChooseFile` always
   shows "No applicable files found." This means Load Game and View Recording options are entirely
   non-functional. Needs a test.skip in menus.test.ts.

2. `ctx.loadRunHistory: () => []` (menus.ts:262) — **untracked wiring stub** — `viewGameStats`
   always shows empty All Time and Recent stats. Needs a test.skip in menus.test.ts.

3. `ctx.saveResetRun: () => {}` (menus.ts:263) — **untracked wiring stub** — stat reset markers
   are silently dropped. Needs a test.skip in menus.test.ts.

4. `titleMenu` — the title screen event loop; drives all menu navigation; completely untested.
   Any regression in button layout, flame animation, or flyout state could silently break the
   main menu without test failure.

5. `mainBrogueJunction` — the top-level entry point called from bootstrap.ts:main(); orchestrates
   variant init, flame setup, title loop, and game launch; completely untested.

6. `dialogChooseFile` — file chooser dialog; completely untested; non-functional due to listFiles stub.

7. `viewGameStats` — stats display screen; completely untested; non-functional due to loadRunHistory stub.

## Notes for follow-on initiative

**MainMenu.c has zero porting gaps** — all gameplay logic that can be ported is ported. The
NEEDS-VERIFICATION backlog is entirely a testing gap, not a porting gap.

**Three untracked wiring stubs need test.skip entries (Phase 3 cleanup):**
- `listFiles: () => []` at `menus.ts:261`
- `loadRunHistory: () => []` at `menus.ts:262`
- `saveResetRun: () => {}` at `menus.ts:263`

**Platform work required before menu functions can be E2E tested:**
The `listFiles`, `loadRunHistory`, and `saveResetRun` context slots need browser implementations
(IndexedDB or localStorage). This is port-v2-platform work, not port-v2-fix work.
Until then, Load Game, View Recording, and Game Stats are feature-blocked, not broken.

**Two structural simplifications from C that are intentional:**
1. `stringsExactlyMatch` — C used a custom strcmp loop; TS uses `.endsWith()` idiom. Semantically
   equivalent for suffix matching.
2. `fileEntryCompareDates` — C used qsort with a struct comparator; TS uses `.sort()` with
   a date comparison lambda. Semantically equivalent.

**Priority order for direct tests (follow-on test pass):**
1. `isFlyoutActive` — pure predicate; trivial to test; high leverage (drives flyout menu state)
2. `getNextGameButtonPos` — pure function over button array; trivial to test
3. `antiAlias` — deterministic pixel operation; straightforward to unit test with a 3x3 mask
4. `initializeMainMenuButton` — factory function; verify hotkey and command fields are set
5. `stackButtons` — verify button positions after stacking
6. `initializeMenu` — verify ButtonState is constructed with correct fields
7. `drawMenuFlames` — requires ctx mock; verify plotCharWithColor is called for flame cells
8. `initializeMenuFlames` — end-to-end; verify flame grid is non-zero after initialization
9. `quitImmediately` — verify returns 1 (exit status)
10. `dialogAlert` — requires ctx mock; verify a button dialog is shown
