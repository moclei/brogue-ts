# Port V2 — Platform — Tasks

## Phase 1: Browser Platform
- [x] Copy `ts/src/platform/browser-renderer.ts` → `rogue-ts/src/platform/` (adjust imports)
- [x] Copy `ts/src/platform/glyph-map.ts` → `rogue-ts/src/platform/` (adjust imports)
- [x] Copy `ts/src/platform/null-platform.ts` → `rogue-ts/src/platform/`
- [x] Verify platform files compile — added `"DOM"` to tsconfig lib; 0 platform errors

## Phase 2: platform.ts — Async Bridge + Main Loop
- [x] Implement `waitForEvent()` — async wrapper over browser event queue
- [x] Implement `peekEvent()` — non-blocking queue check (playback only)
- [x] Implement `processEvent(event)` — dispatches keystroke/mouse to input context
- [x] Implement `mainGameLoop()` — `while (!gameHasEnded) { await processEvent(await waitForEvent()); }`
- [x] Wire left-click directly to `movement.travel(cell, true)` — no intermediate loop
- [x] Wire right-click stub (Phase 5 will wire to inventory)
- [x] Write test: left-click dispatches travel without confirmation dialog — 5 tests passing
- [x] Verify `platform.ts` is under 600 lines — 173 lines

## Phase 3: IO Display Layer
- [x] Port `io/display.ts` from `ts/src/io/io-display.ts` + `io-appearance.ts` (combined, 483 lines)
- [x] Port `io/effects.ts` + `io/effects-alerts.ts` from `ts/src/io/io-effects.ts` (split at 518+190 lines)
- [x] Port `io/messages-state.ts` + `io/messages.ts` from `ts/src/io/io-messages.ts` (split at 319+582 lines)
- [x] Port `io/sidebar-player.ts` + `io/sidebar-monsters.ts` from `ts/src/io/io-sidebar.ts` (split at 468+600 lines)
- [x] Port `io/inventory.ts` + `io/inventory-display.ts` from `ts/src/io/io-inventory.ts` (split at 325+399 lines)
- [x] Port `io/targeting.ts` from `ts/src/io/io-targeting.ts` (350 lines)
- [x] Port `io/color.ts` from `ts/src/io/io-color.ts` (496 lines)
- [x] Port `io/text.ts` from `ts/src/io/io-text.ts` (340 lines) — needed by messages/sidebar
- [x] Verify all IO files compile and are under 600 lines — 0 IO errors; all under 600

## Phase 4: Input Dispatch
Note: source is 1,875 lines; 4-file split required by 600-line hard constraint.
- [x] Port `io/input-keystrokes.ts` — shared interfaces + event infrastructure (pauseBrogue, nextBrogueEvent, waiters) — 440 lines
- [x] Port `io/input-dispatch.ts` — confirm, getInputTextString, executeKeystroke — 502 lines
- [x] Port `io/input-mouse.ts` — executeMouseClick (simplified), executeEvent, initializeMenuButtons, actionMenu — 359 lines
- [x] Port `io/input-cursor.ts` — mainInputLoop (cursor/path mode) — 369 lines
- [x] Verify: no synchronous event polling spin loops remain — all functions use nextKeyOrMouseEvent via nextBrogueEvent; no spin loops
- [x] Wire keystroke dispatch to domain context actions (move, apply, inventory, etc.)

## Phase 5: ui.ts Wiring Completion
- [x] Return to `ui.ts` from port-v2-wiring and replace any IO stubs with real IO function calls
- [x] Verify all `buildDisplayContext()`, `buildInventoryContext()`, `buildButtonContext()` are wired
  Note: display buffer ops, color/text ops, and apply action are wired to real io/ functions.
  refreshDungeonCell, refreshSideBar, displayLevel, updateFlavorText, flashTemporaryAlert remain stubbed
  (need dungeon appearance system). nextBrogueEvent/pauseBrogue event bridge remains stubbed (Phase 7).

## Phase 6: Menus
- [x] Port `menus/main-menu.ts` from `ts/src/menus/main-menu.ts` — split into 5 files (menu-types, menu-flames, menu-buttons, character-select, main-menu); all under 600 lines
- [x] Port `menus/character-select.ts` (split from main-menu: game variant/mode dialogs, file chooser, game stats)
- [x] Port `menus/wizard.ts` from `ts/src/menus/wizard.ts` — split into wizard.ts + wizard-items.ts; wizard functions made async (buttonInputLoop, confirm, getInputTextString are async in new port)
- [x] Stub save/load with `test.skip` entries — 4 stubs in `tests/menus/menus.test.ts`; 4 active tests passing

## Phase 7: Entry Point + Integration
- [x] Write `rogue-ts/src/lifecycle.ts` — buildGameInitContext, buildLevelContext, buildCleanupContext wiring; public initializeRogue/startLevel/freeEverything
- [x] Write `rogue-ts/src/menus.ts` — buildMenuContext() wiring nextBrogueEvent→waitForEvent, pauseBrogue→setTimeout, all display/button/text ops, game lifecycle
- [x] Write `rogue-ts/src/bootstrap.ts` — browser entry point, mounts canvas, calls initPlatform + mainBrogueJunction
- [x] Write `rogue-ts/src/index.ts` — module exports
- [x] Add `vite`, `vite.config.ts`, `index.html` to rogue-ts — `npm run build:web` produces dist/ bundle (92 modules, 599 kB)
- [x] Fix pre-existing type errors in `movement.ts`, `items.ts`, `monsters.ts` — 0 TypeScript errors
- [ ] Start new game in browser — level should generate and render
- [ ] Walk around, pick up an item, fight a monster, use a scroll — no crashes
- [ ] Record any new bugs found in a new `playtest-v2/` initiative (do not fix inline)

## Completion
- [ ] Game is playable end-to-end in browser
- [x] No synchronous event polling spin loops
- [x] All files under 600 lines
- [ ] All stubs have paired `test.skip` entries
- [ ] Committed: "feat: port-v2 platform — browser IO and game loop complete"
