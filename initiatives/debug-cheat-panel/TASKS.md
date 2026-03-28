# Debug Cheat Panel — Tasks

## Phase 1: Panel Scaffold + Invincibility

- [x] Create branch `feature/debug-cheat-panel` from `master`
- [x] Add `debugFlags = { immortal, omniscience }` to `game-init.ts`. Updated `game-lifecycle.ts` to use `debugFlags.immortal` instead of `D_IMMORTAL`. Old `D_IMMORTAL` const kept as deprecated for test compatibility.
- [x] Create `rogue-ts/src/platform/game-debug-panel.ts` — floating HTML panel. Contains: close button, invincibility checkbox wired to `debugFlags.immortal`, depth jump input + button, give item dropdowns + button. All three features in one file (~270 lines).
- [x] Create `rogue-ts/src/lifecycle-debug.ts` — `buildDebugItemContext()` helper (lifecycle.ts was already at 614 lines).
- [x] Update `bootstrap.ts` F2 handler: import `toggleCheatPanel`, remove `toggleDebugPanel` import. `spriteDebug` import kept (dirty-poll and click-to-inspect still live in bootstrap.ts).
- [ ] **Manual verification**: open game, press F2, panel appears. Toggle invincibility on. Take lethal damage — survive. Toggle off — die normally. Close panel, reopen — checkbox reflects current state. Depth jump and give item to verify.
- [ ] Run `npm test` — confirm no new failures (2 preexisting failures in sprite-renderer.test.ts are not from this initiative).
