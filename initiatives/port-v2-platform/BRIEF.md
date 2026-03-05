# Port V2 — Platform

## Intent
Wire the browser platform, IO/UI layer, and menus so the game runs end-to-end in a browser. This initiative converts `rogue-ts/` from a compiling module library into a playable game.

## Goals
- Browser renders the game correctly (100×34 character grid, colors, sidebar)
- Player can start a new game from the main menu
- Keyboard input, mouse movement, and mouse clicks all work
- Player can take turns, fight monsters, pick up items, use items, descend stairs
- First playtest session can start without crashing

## Scope
What's in:
- `rogue-ts/src/platform/` — browser canvas renderer, keyboard/mouse event handling
- `rogue-ts/src/platform.ts` — async event bridge, main game loop
- `rogue-ts/src/io/` — all in-game UI: messages, sidebar, inventory, targeting, effects
- `rogue-ts/src/menus/` — main menu, character screen
- `rogue-ts/src/bootstrap.ts` — browser entry point
- Adaptation of first attempt's IO/platform files (use as reference, rewrite to fit new wiring layer)

What's out:
- Save/load (deferred — flag as stub)
- Recording/playback (deferred — flag as stub)
- Node.js terminal platform (out of scope entirely)

## Constraints
- The async bridge rule from port-v2-wiring applies here: all event waiting is async, no synchronous spin loops
- IO files follow the same 600-line limit
- The `io-input.ts` synchronous `mainInputLoop` from the first attempt must NOT be ported as-is — replace with the async pattern established in `platform.ts`
