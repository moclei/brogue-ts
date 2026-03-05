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
- [ ] Port `io/display.ts` from `ts/src/io/io-display.ts` + `io-appearance.ts` (adapt context imports)
- [ ] Port `io/effects.ts` from `ts/src/io/io-effects.ts`
- [ ] Port `io/messages.ts` from `ts/src/io/io-messages.ts` (split if >600 lines)
- [ ] Port `io/sidebar.ts` from `ts/src/io/io-sidebar.ts` (split if >600 lines)
- [ ] Port `io/inventory.ts` from `ts/src/io/io-inventory.ts`
- [ ] Port `io/targeting.ts` from `ts/src/io/io-targeting.ts`
- [ ] Port `io/color.ts` from `ts/src/io/io-color.ts`
- [ ] Verify all IO files compile and are under 600 lines

## Phase 4: Input Dispatch
- [ ] Port `io/input-keystrokes.ts` from `ts/src/io/io-input.ts` (keyboard handling only, async)
- [ ] Port `io/input-mouse.ts` from `ts/src/io/io-input.ts` (mouse handling only, async)
- [ ] Verify: no synchronous event polling spin loops remain
- [ ] Wire keystroke dispatch to domain context actions (move, apply, inventory, etc.)

## Phase 5: ui.ts Wiring Completion
- [ ] Return to `ui.ts` from port-v2-wiring and replace any IO stubs with real IO function calls
- [ ] Verify all `buildDisplayContext()`, `buildInventoryContext()`, `buildButtonContext()` are wired

## Phase 6: Menus
- [ ] Port `menus/main-menu.ts` from `ts/src/menus/main-menu.ts` (split if >600 lines)
- [ ] Port `menus/character-select.ts` (split from main-menu if needed)
- [ ] Port `menus/wizard.ts` from `ts/src/menus/wizard.ts` (if under 600 lines; split if not)
- [ ] Stub save/load with `test.skip` entries

## Phase 7: Entry Point + Integration
- [ ] Write `rogue-ts/src/bootstrap.ts` — browser entry point, mounts canvas, starts `mainGameLoop()`
- [ ] Write `rogue-ts/src/index.ts` — module exports
- [ ] Build and load in browser — game should reach the main menu
- [ ] Start new game — level should generate and render
- [ ] Walk around, pick up an item, fight a monster, use a scroll — no crashes
- [ ] Record any new bugs found in a new `playtest-v2/` initiative (do not fix inline)

## Completion
- [ ] Game is playable end-to-end in browser
- [ ] No synchronous event polling spin loops
- [ ] All files under 600 lines
- [ ] All stubs have paired `test.skip` entries
- [ ] Committed: "feat: port-v2 platform — browser IO and game loop complete"
