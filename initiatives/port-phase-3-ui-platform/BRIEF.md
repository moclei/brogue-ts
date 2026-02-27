# Phase 3: UI & Platform

## Intent
Port the UI, menu, game loop, and platform abstraction layers from BrogueCE's C source into TypeScript, building on the complete game logic foundation (Phases 0–2). This phase turns the ported engine into something playable — it produces visible output on screen and responds to player input.

## Goals
- Port all in-game UI rendering: messages, sidebar, inventory, targeting, cell appearance, color manipulation, text display, visual effects (IO.c)
- Port button/menu widgets, title screen with flame animation, main menu navigation (Buttons.c, MainMenu.c)
- Port debug/wizard mode (Wizard.c)
- Port game loop orchestration: initialization, level transitions, game over/victory, save/load, cleanup (RogueMain.c)
- Define the TypeScript `BrogueConsole` platform interface (equivalent to C's `brogueConsole` struct)
- Implement a Canvas2D browser renderer for the 100×34 character grid
- Wire up deferred Phase 2 stubs: interactive scroll/potion/wand handlers, playback UI, interactive save/load dialogs, annotation system
- Produce a playable game running in the browser

## Scope

What's in:
- IO.c (5,128 lines) — all in-game UI
- Buttons.c (368 lines) — button widget system
- MainMenu.c (1,286 lines) — title screen, menus, file selection
- Wizard.c (522 lines) — debug mode dialogs
- RogueMain.c (1,414 lines) — game init, level transitions, game over/victory, cleanup
- Platform interface definition (TypeScript equivalent of `brogueConsole`)
- Canvas2D browser renderer
- Deferred Phase 2 items (interactive item handlers, playback UI, `loadSavedGame`)

What's out:
- Node.js terminal platform (Phase 4)
- Seed catalog regression tests (Phase 4)
- React Native or web extension platforms (future)
- New gameplay features or balance changes

## Constraints
- Maintain DI context pattern — no global state (consistent with Phases 0–2)
- All ported functions must have unit tests (vitest)
- Platform interface must be fully abstract — game logic never imports platform code
- UI rendering functions should produce testable output (display buffer state) without requiring a real renderer
- TypeScript strict mode throughout
