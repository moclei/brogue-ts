# Port V2 — Platform — Plan

## Approach

Port the IO/UI layer and browser platform, adapting from the first attempt rather than porting from C directly. The first attempt's IO files (`ts/src/io/`) are a reasonable reference — the core display and input logic is correct. The issue was how they integrated with `runtime.ts`. In this attempt, they integrate with the domain context builders instead.

### Async Main Loop

The central design decision: the main game loop is a single async function in `platform.ts` that never synchronously blocks.

```typescript
// platform.ts
async function mainGameLoop(): Promise<void> {
    while (!rogue.gameHasEnded) {
        const event = await waitForEvent();   // true async wait
        await processEvent(event);            // dispatches to input context
    }
}
```

All C code paths that previously called blocking functions (getEvent, etc.) route through this. The UI context builders receive an async `nextBrogueEvent` that calls `waitForEvent()`. This is the same pattern that worked correctly in the first attempt's `buildButtonContext()` — we generalize it everywhere.

### Mouse Click Handling

The first attempt's bug: left-click routing through io-input.ts `mainInputLoop` which used a synchronous spin loop. In this attempt:
- Left-click: directly calls `await movement.travel(clickedCell, true)` — no intermediate loop
- Right-click: opens inventory via async `buildButtonContext().nextBrogueEvent`
- Hover: updates sidebar, no event needed

### IO File Structure

Adapt from first attempt's `ts/src/io/` files. Each file takes a context object (from the relevant domain builder) rather than importing from runtime.ts.

| File | Responsibility | Reference |
|------|---------------|-----------|
| `io/display.ts` | Level rendering, cell appearance | `ts/src/io/io-display.ts`, `ts/src/io/io-appearance.ts` |
| `io/messages.ts` | Message queue, archive display | `ts/src/io/io-messages.ts` |
| `io/sidebar.ts` | Status sidebar, monster descriptions | `ts/src/io/io-sidebar.ts` |
| `io/inventory.ts` | Inventory screen, item selection | `ts/src/io/io-inventory.ts` |
| `io/targeting.ts` | Targeting cursor and display | `ts/src/io/io-targeting.ts` |
| `io/effects.ts` | Visual effects (flashes, animations) | `ts/src/io/io-effects.ts` |
| `io/input.ts` | Keystroke dispatch (async) | `ts/src/io/io-input.ts` (rewrite async sections) |

Files in `ts/src/io/` that were already using async correctly (buttons, inventory dialogs) can be adapted with minimal changes. Files that mixed synchronous polling with async (io-input.ts's mainInputLoop) must be rewritten.

### Platform Layer

`platform/browser-renderer.ts` from the first attempt is largely correct — it handles canvas rendering, font loading, glyph mapping, and the keyboard/mouse event queue. Copy it as-is into `rogue-ts/src/platform/` and adjust imports.

## Technical Notes

### Splitting large IO files

Several IO files from the first attempt exceed 600 lines:
- `io-input.ts` (1,875 lines) → split into `io/input-keystrokes.ts` + `io/input-mouse.ts`
- `io-sidebar.ts` (1,092 lines) → split into `io/sidebar-player.ts` + `io/sidebar-monsters.ts`
- `io-messages.ts` (860 lines) → may need splitting depending on final size
- `menus/main-menu.ts` (1,697 lines) → split into `menus/main-menu.ts` + `menus/character-select.ts`

All splits must maintain the 600-line limit.

## Open Questions
- Should `platform/browser-renderer.ts` be split? It is 419 lines and within the limit.
- How to handle the recordings subsystem — wire as a stub context (returns no-op for all calls) or skip entirely for now?
