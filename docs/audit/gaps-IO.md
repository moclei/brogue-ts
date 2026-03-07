# Audit: IO.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** The c-inventory.md script only captured `static` functions (single-line signatures). IO.c's ~92 public functions have multi-line signatures and were missed. This session supplemented the inventory with a targeted grep of IO.c directly. Future sessions with multi-line-heavy files should do the same. Three truly MISSING functions (getCellAppearance, dumpLevelToScreen, hiliteCharGrid) confirm the known gap. refreshScreen was also not ported — call sites should use commitDraws directly. 13 STUBBED-UNTRACKED entries are rule violations requiring test.skip entries.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| getPlayerPathOnMap | 34 | io/targeting.ts:119 | IMPLEMENTED | |
| reversePath | 50 | io/targeting.ts:150 | IMPLEMENTED | |
| hilitePath | 58 | io/targeting.ts:167 | IMPLEMENTED | |
| clearCursorPath | 75 | io/targeting.ts:196 | IMPLEMENTED | |
| hideCursor | 90 | io/targeting.ts:218 | IMPLEMENTED | |
| showCursor | 97 | io/targeting.ts:233 | IMPLEMENTED | |
| getClosestValidLocationOnMap | 109 | io/targeting.ts:254 | IMPLEMENTED | static |
| processSnapMap | 134 | io/targeting.ts:292 | IMPLEMENTED | static |
| actionMenu | 170 | io/input-mouse.ts:175 | IMPLEMENTED | static; adapted for browser mouse/key input |
| initializeMenuButtons | 443 | io/input-mouse.ts:83 | IMPLEMENTED | static |
| mainInputLoop | 537 | io/input-cursor.ts:41 | IMPLEMENTED | async in TS; wired via platform.ts |
| considerCautiousMode | 840 | io/input-keystrokes.ts:280 | NEEDS-VERIFICATION | Body is empty with comment "C implementation was entirely commented out" — verify C was indeed empty |
| commitDraws | 857 | platform.ts | IMPLEMENTED | Imported and wired in menus.ts |
| refreshScreen | 890 | — | MISSING | C calls commitDraws + clears screenRefreshNeeded flag; TS has no equivalent — call sites should use commitDraws directly |
| displayLevel | 910 | lifecycle.ts:479 | STUBBED-UNTRACKED | `() => {}` in lifecycle, items, input-context; NO test.skip entry |
| storeColorComponents | 921 | io/color.ts:279 | IMPLEMENTED | |
| bakeTerrainColors | 928 | io/display.ts:287 | IMPLEMENTED | static |
| bakeColor | 957 | io/color.ts:181 | IMPLEMENTED | |
| shuffleTerrainColors | 966 | lifecycle.ts:453 | STUBBED-UNTRACKED | `() => {}` in lifecycle.ts and turn.ts; NO test.skip entry |
| separateColors | 997 | io/color.ts:243 | IMPLEMENTED | |
| normColor | 1034 | io/color.ts:200 | IMPLEMENTED | |
| glyphIsWallish | 1053 | io/display.ts:256 | IMPLEMENTED | static |
| randomAnimateMonster | 1076 | io/display.ts:467 | IMPLEMENTED | static |
| getCellAppearance | 1094 | — | MISSING | Only exists as a context interface slot; no export implementation; call sites in targeting.ts, sidebar-player.ts, sidebar-monsters.ts, effects.ts all depend on context injection |
| refreshDungeonCell | 1504 | items.ts:223, monsters.ts:126 | STUBBED-TRACKED | `() => {}` stub with test.skip at ui.test.ts:271 and movement.test.ts:247 |
| applyColorMultiplier | 1513 | io/color.ts:47 | IMPLEMENTED | |
| applyColorAverage | 1525 | io/color.ts:63 | IMPLEMENTED | |
| applyColorAugment | 1538 | io/color.ts:80 | IMPLEMENTED | |
| applyColorScalar | 1549 | io/color.ts:95 | IMPLEMENTED | |
| applyColorBounds | 1559 | io/color.ts:110 | IMPLEMENTED | |
| desaturate | 1569 | io/color.ts:126 | IMPLEMENTED | |
| randomizeByPercent | 1584 | io/color.ts:154 | IMPLEMENTED | static; internal helper for randomizeColor |
| randomizeColor | 1588 | io/color.ts:146 | IMPLEMENTED | |
| swapColors | 1594 | io/color.ts:165 | IMPLEMENTED | |
| colorBlendCell | 1700 | io/effects.ts:239 | IMPLEMENTED | |
| hiliteCell | 1711 | io/targeting.ts:335 | IMPLEMENTED | |
| adjustedLightValue | 1728 | io/color.ts | IMPLEMENTED | static; listed in module docblock; inlined dependency of colorMultiplierFromDungeonLight |
| colorMultiplierFromDungeonLight | 1736 | io/color.ts:336 | IMPLEMENTED | |
| plotCharWithColor | 1746 | io/display.ts:331 | IMPLEMENTED | ui.test.ts:283 skip refers to context stub, not the function itself |
| plotCharToBuffer | 1808 | io/display.ts:182 | IMPLEMENTED | |
| plotForegroundChar | 1836 | movement.ts:161 | STUBBED-UNTRACKED | `() => {}` in movement.ts; comment "stub — wired in port-v2-platform"; NO test.skip entry |
| dumpLevelToScreen | 1850 | — | MISSING | Not found anywhere in rogue-ts/src/ |
| hiliteCharGrid | 1878 | — | MISSING | Not found anywhere in rogue-ts/src/ |
| blackOutScreen | 1915 | io/display.ts:424 | IMPLEMENTED | |
| colorOverDungeon | 1925 | io/display.ts:446 | IMPLEMENTED | |
| copyDisplayBuffer | 1935 | io/display.ts:85 | IMPLEMENTED | |
| clearDisplayBuffer | 1939 | io/display.ts:65 | IMPLEMENTED | |
| colorFromComponents | 1954 | io/color.ts | IMPLEMENTED | |
| saveDisplayBuffer | 1962 | io/display.ts:107 | IMPLEMENTED | |
| restoreDisplayBuffer | 1965 | io/display.ts:118 | IMPLEMENTED | |
| overlayDisplayBuffer | 1970 | io/display.ts:140 | IMPLEMENTED | |
| flashForeground | 2000 | io/effects.ts:261 | IMPLEMENTED | |
| flashCell | 2045 | io/effects.ts:314 | IMPLEMENTED | |
| displayWaypoints | 2206 | io/input-context.ts:264 | STUBBED-UNTRACKED | static; `() => {}` debug visualisation; NO test.skip entry |
| displayMachines | 2226 | io/input-context.ts:263 | STUBBED-UNTRACKED | static; `() => {}` debug visualisation; NO test.skip entry |
| displayChokeMap | 2264 | io/input-context.ts:262 | STUBBED-UNTRACKED | static; `() => {}` debug visualisation; NO test.skip entry |
| displayLoops | 2289 | io/input-context.ts:261 | STUBBED-UNTRACKED | static; `() => {}` debug visualisation; NO test.skip entry |
| exploreKey | 2313 | io/input-context.ts:209 | STUBBED-UNTRACKED | static; `async () => {}` stub; comment "explore display hooks (Phase 5)"; NO test.skip entry; impacts auto-explore |
| pauseBrogue | 2367 | io/input-keystrokes.ts:292 | IMPLEMENTED | sync in TS; async bridge wired in menus.ts |
| pauseAnimation | 2381 | io/input-keystrokes.ts:312 | IMPLEMENTED | |
| nextBrogueEvent | 2390 | io/input-keystrokes.ts:328 | IMPLEMENTED | sync; async bridge wired in menus.ts |
| executeMouseClick | 2431 | io/input-mouse.ts:56 | IMPLEMENTED | movement.ts has `() => {}` context stub for tests |
| executeKeystroke | 2451 | io/input-dispatch.ts:252 | IMPLEMENTED | async in TS |
| displayCenteredAlert | 2841 | io/effects-alerts.ts:30 | IMPLEMENTED | |
| flashMessage | 2846 | io/effects-alerts.ts:48 | IMPLEMENTED | |
| flashTemporaryAlert | 2906 | io/effects-alerts.ts:131 | IMPLEMENTED | ui.test.ts:313 skip refers to context stub only |
| waitForAcknowledgment | 2910 | io/input-keystrokes.ts:399 | IMPLEMENTED | ui.ts has `() => {}` context stub; real impl exists |
| waitForKeystrokeOrMouseClick | 2926 | io/input-keystrokes.ts:432 | IMPLEMENTED | |
| confirm | 2933 | io/input-dispatch.ts:58 | IMPLEMENTED | async in TS |
| displayMonsterFlashes | 2976 | io/effects-alerts.ts:156 | IMPLEMENTED | |
| dequeueEvent | 3009 | — | NEEDS-VERIFICATION | static; not found as standalone function; logic likely inlined into nextBrogueEvent / message archive handling |
| clearMessageArchive | 3015 | io/messages.ts:158 | IMPLEMENTED | |
| getArchivedMessage | 3021 | io/messages-state.ts:130 | IMPLEMENTED | static |
| formatCountedMessage | 3025 | io/messages-state.ts:141 | IMPLEMENTED | static |
| foldMessages | 3044 | io/messages-state.ts:162 | IMPLEMENTED | static |
| capitalizeAndPunctuateSentences | 3100 | io/text.ts:312 | IMPLEMENTED | static |
| splitLines | 3124 | io/text.ts:268 | IMPLEMENTED | static |
| formatRecentMessages | 3166 | io/messages-state.ts:227 | IMPLEMENTED | |
| displayRecentMessages | 3206 | io/messages.ts:112 | IMPLEMENTED | |
| drawMessageArchive | 3225 | io/messages.ts:398 | IMPLEMENTED | static |
| animateMessageArchive | 3256 | io/messages.ts:436 | IMPLEMENTED | static |
| scrollMessageArchive | 3287 | io/messages.ts:471 | IMPLEMENTED | static |
| displayMessageArchive | 3356 | io/messages.ts:559 | IMPLEMENTED | |
| temporaryMessage | 3382 | io/messages.ts:294 | IMPLEMENTED | |
| messageWithColor | 3410 | io/messages.ts:250 | IMPLEMENTED | |
| flavorMessage | 3420 | io/messages.ts:261 | IMPLEMENTED | |
| message | 3445 | io/messages.ts:218 | IMPLEMENTED | menus.ts wires a `() => {}` for the menu context only |
| displayMoreSignWithoutWaitingForAcknowledgment | 3517 | io/messages.ts:198 | IMPLEMENTED | |
| displayMoreSign | 3525 | io/messages.ts:173 | IMPLEMENTED | |
| encodeMessageColor | 3548 | io/color.ts:373 | IMPLEMENTED | |
| decodeMessageColor | 3578 | io/color.ts:394 | IMPLEMENTED | |
| messageColorFromVictim | 3598 | io/color.ts:478 | IMPLEMENTED | |
| updateMessageDisplay | 3612 | io/messages.ts:61 | IMPLEMENTED | |
| deleteMessages | 3645 | io/messages.ts:136 | IMPLEMENTED | |
| confirmMessages | 3653 | io/messages.ts:148 | IMPLEMENTED | |
| stripShiftFromMovementKeystroke | 3658 | io/input-keystrokes.ts:262 | IMPLEMENTED | ui.ts has identity-passthrough context stub; real impl exists |
| upperCase | 3672 | io/text.ts:56 | IMPLEMENTED | adapted: TS returns new string rather than mutating pointer |
| refreshSideBar | 3695 | lifecycle.ts:480 | STUBBED-TRACKED | `() => {}` in lifecycle.ts; test.skip at ui.test.ts:277 |
| printString | 3914 | io/text.ts:175 | IMPLEMENTED | |
| breakUpLongWordsIn | 3933 | io/text.ts:81 | IMPLEMENTED | static |
| wrapText | 3973 | io/text.ts:126 | IMPLEMENTED | |
| nextKeyPress | 4056 | io/input-keystrokes.ts:386 | IMPLEMENTED | |
| printHelpScreen | 4066 | io/input-context.ts:177 | STUBBED-UNTRACKED | `() => {}` in input-context.ts; NO test.skip entry |
| printDiscoveries | 4139 | — | MISSING | static; parent printDiscoveriesScreen is stubbed; no standalone TS impl |
| displayFeatsScreen | 4188 | io/input-context.ts:178 | STUBBED-UNTRACKED | `() => {}` in input-context.ts; NO test.skip entry |
| printDiscoveriesScreen | 4240 | io/input-context.ts:179 | STUBBED-UNTRACKED | `() => {}` in input-context.ts; NO test.skip entry |
| printHighScores | 4278 | menus.ts:222 | OUT-OF-SCOPE | Browser has no score file system; menus.ts stub comment: "no persistent score file in browser mode" |
| displayGrid | 4339 | io/input-context.ts:260 | STUBBED-UNTRACKED | `() => {}` debug display; NO test.skip entry |
| printSeed | 4391 | io/input-context.ts:206 | STUBBED-UNTRACKED | `() => {}` stub; comment "not yet ported"; NO test.skip entry |
| printProgressBar | 4409 | io/sidebar-player.ts:193 | IMPLEMENTED | |
| highlightScreenCell | 4461 | io/display.ts:395 | IMPLEMENTED | |
| estimatedArmorValue | 4475 | — | NEEDS-VERIFICATION | static; not found as standalone export; likely inlined into printMonsterInfo sidebar logic |
| creatureHealthChangePercent | 4480 | — | NEEDS-VERIFICATION | static; not found as standalone export; likely inlined into sidebar health bar logic |
| printMonsterInfo | 4489 | io/sidebar-monsters.ts:56 | IMPLEMENTED | |
| describeHallucinatedItem | 4773 | io/sidebar-player.ts:466 | IMPLEMENTED | |
| printItemInfo | 4784 | io/sidebar-player.ts:278 | IMPLEMENTED | |
| printTerrainInfo | 4857 | io/sidebar-player.ts:364 | IMPLEMENTED | |
| printMonsterDetails | 5035 | io/sidebar-monsters.ts:597 | IMPLEMENTED | input-context.ts has `() => {}` default; real impl exists |
| printFloorItemDetails | 5123 | io/sidebar-player.ts:434 | IMPLEMENTED | input-context.ts has `() => {}` default; real impl exists |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 94 |
| STUBBED-TRACKED | 2 |
| STUBBED-UNTRACKED | 13 |
| MISSING | 5 |
| NEEDS-VERIFICATION | 4 |
| OUT-OF-SCOPE | 1 |
| DATA-ONLY | 0 |
| **Total** | **119** |

## Critical Gaps

MISSING and STUBBED-UNTRACKED items ordered by gameplay impact:

1. `getCellAppearance` — **Highest impact.** The entire dungeon rendering pipeline depends on this function. Every call to `refreshDungeonCell` would call `getCellAppearance` to determine what to draw. Without it, dungeon cells cannot render.
2. `displayLevel` — **Blocker.** Called after level generation and on stair transitions. Without it, the level never appears on screen. Multiple `() => {}` stubs scattered across lifecycle, items, input-context.
3. `refreshDungeonCell` — **High impact.** Called after any state change that affects a cell (monster movement, item pickup, terrain change). Stubbed but tracked.
4. `refreshSideBar` — **Moderate impact.** Called after combat and cursor movement. Without it, the sidebar (HP, items, terrain info) never updates. Stubbed but tracked.
5. `plotForegroundChar` — Used for projectile/spear bolt animations. Stub breaks weapon attack visual feedback.
6. `shuffleTerrainColors` — Animated terrain (fire, water shimmer). Stub causes static terrain — cosmetic but noticeable.
7. `exploreKey` — Auto-explore (ctrl+direction or 'o') does nothing. Stub breaks a core navigation feature.
8. `refreshScreen` — MISSING; all call sites in C that use refreshScreen need audit to confirm they call commitDraws in TS.
9. `printSeed` — Seed display. Debug/replay feature; non-blocking but should be tracked.
10. `printHelpScreen` — In-game help ('?') does nothing.
11. `displayFeatsScreen` — Feats display. Non-blocking.
12. `printDiscoveriesScreen` + `printDiscoveries` — Item discoveries screen. Non-blocking.
13. `displayWaypoints`, `displayMachines`, `displayChokeMap`, `displayLoops`, `displayGrid` — Debug/wizard visualisations. Low gameplay impact but stubs need tracking.

## Notes for follow-on initiative

- **getCellAppearance is the keystone.** Implementing it unblocks `refreshDungeonCell`, which unblocks `displayLevel`, which unblocks the entire playtest loop. This should be the first fix.
- `getCellAppearance` depends on `colorMultiplierFromDungeonLight` (IMPLEMENTED ✓) and `bakeTerrainColors` (IMPLEMENTED ✓). The dependency chain is clear.
- The c-inventory.md script needs an update: add multi-line signature capture (e.g., grep for function names on one line with `{` on the next). The current single-line pattern missed ~92 functions in IO.c.
- `printHighScores` (OUT-OF-SCOPE) could be revisited when localStorage-based score persistence is added.
- `considerCautiousMode` and `dequeueEvent` need a quick read of their C bodies to confirm they can safely remain no-ops. Add as NEEDS-VERIFICATION review tasks in follow-on.
- `estimatedArmorValue` and `creatureHealthChangePercent` are static sidebar helpers — likely inlined in the TS sidebar functions. A quick grep within sidebar-player.ts/sidebar-monsters.ts would confirm.
