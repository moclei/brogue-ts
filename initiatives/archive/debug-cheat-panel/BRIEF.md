# Debug Cheat Panel

## Intent

Repurpose the F2 key from the sprite-debug overlay (now superseded by dungeon-cake) into an in-game debug/cheat panel. The panel gives quick access to the three things most needed when recreating specific test scenarios: granting any item, jumping to a target depth, and toggling invincibility.

## Goals

- F2 opens a floating HTML panel with three controls: invincibility toggle, depth jump, and give item.
- Invincibility state persists while the panel is closed — toggling it on survives panel close/reopen.
- Depth jump teleports to any dungeon level (1–40) immediately.
- Give item: two-level dropdowns (category → kind) populate dynamically; clicking Give adds the item to inventory.
- Panel reflects current invincibility state each time it opens.
- No regressions in dungeon-cake (it accesses the `spriteDebug` singleton directly, not through F2).

## Scope

What's in:
- New file `rogue-ts/src/platform/game-debug-panel.ts` — floating HTML panel, three controls
- `D_IMMORTAL` in `game-init.ts` changed from `const` to `let` (runtime-toggleable)
- `buildDebugItemContext()` helper in `lifecycle.ts` for item generation
- `bootstrap.ts` F2 handler wired to the new panel instead of the sprite-debug toggle

What's out:
- Monster spawning (can be added later)
- Full Wizard.c dialog (interactive in-game menu) — the simpler HTML dropdown is sufficient
- Save/load integration — debug state is session-only, not persisted
- Removing `sprite-debug.ts` / `sprite-debug-detail.ts` — dungeon-cake still depends on them; removal is tracked in the dungeon-cake roadmap

## Constraints

- 600-line file limit applies.
- Debug panel is session-only: no localStorage, no save-file impact.
- Invincibility is a dev-only flag; it must not affect recordings or save compatibility.
