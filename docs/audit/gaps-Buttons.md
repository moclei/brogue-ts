# Audit: Buttons.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** c-inventory.md captured zero functions for Buttons.c — all 8 functions are public
(non-static), so the inventory script (which relied on `static` patterns) missed them entirely.
Supplemented with the public-function grep pass. Total: 8 functions. TASKS.md estimated ~6 — minor
undercount; TASKS.md did not count `smoothHiliteGradient` (moved to sidebar-player.ts) or
`setButtonText` separately.

Buttons.c is the button rendering and input-processing module. It contains the highlight gradient
utility (`smoothHiliteGradient`), the full button draw pipeline (`drawButton`, `drawButtonsInState`),
button/state initializers (`initializeButton`, `setButtonText`, `initializeButtonState`), and the
two input-processing functions (`processButtonInput`, `buttonInputLoop`) that drive every interactive
dialog in the game.

In the TS port, Buttons.c responsibilities are split across two files:
- `io/buttons.ts` — 7 of 8 functions (all except smoothHiliteGradient)
- `io/sidebar-player.ts` — `smoothHiliteGradient` (relocated because the sidebar is its primary consumer)

**Coverage is complete** — all 8 C functions have real TS implementations with no stubs or missing
logic. All are classified NEEDS-VERIFICATION because no function has a dedicated direct unit test.
The single test in `ui.test.ts:195` exercises the inventory context's wiring stub for `buttonInputLoop`
(which returns `{ chosenButton: -1, event: fakeEvent() }` unconditionally) rather than the domain
function in `buttons.ts`.

Notable wiring stubs (not domain-function gaps, but Phase 3 cleanup needed):
- `initializeButtonState: () => {}` at `io/input-context.ts:156` — no test.skip
- `buttonInputLoop: async () => -1` at `io/input-context.ts:157` — no test.skip
- `buttonInputLoop: async () => ({ chosenButton: -1, event: fakeEvent() })` at `ui.ts:306`
  (comment says "stub — Phase 7") — no test.skip

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| smoothHiliteGradient | 32 | io/sidebar-player.ts:157 | NEEDS-VERIFICATION | Pure math fn (sin curve 0–100); no direct test; relocated to sidebar-player.ts but C origin correctly annotated |
| drawButton | 41 | io/buttons.ts:148 | NEEDS-VERIFICATION | Real impl including gradient, hover, pressed states, color escapes, symbol substitution; no direct test |
| initializeButton | 124 | io/buttons.ts:85 | NEEDS-VERIFICATION | Real impl returning default BrogueButton with correct flags; no direct test |
| setButtonText | 140 | io/buttons.ts:118 | NEEDS-VERIFICATION | Real impl; handles KEYBOARD_LABELS branch and color-escape formatting; no direct test |
| drawButtonsInState | 159 | io/buttons.ts:245 | NEEDS-VERIFICATION | Real impl; delegates to drawButton per button; no direct test |
| initializeButtonState | 175 | io/buttons.ts:269 | NEEDS-VERIFICATION | Real impl; copies buttons array into state struct; no direct test |
| processButtonInput | 203 | io/buttons.ts:310 | NEEDS-VERIFICATION | Real impl; handles mouse (down/up/enter) and keystroke events, hotkey lookup, cancel logic; no direct test |
| buttonInputLoop | 323 | io/buttons.ts:422 | NEEDS-VERIFICATION | Real impl; event loop calling processButtonInput; ui.test.ts:195 tests inventory-context stub, not domain fn |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 0 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 8 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **8** |

## Critical Gaps

No MISSING or STUBBED-UNTRACKED domain functions. The button system is fully ported.

The most significant gaps are three untracked wiring stubs in context builders and the complete
absence of direct tests for `processButtonInput` and `buttonInputLoop`, which drive all interactive
dialogs:

1. `ctx.initializeButtonState: () => {}` (io/input-context.ts:156) — **untracked wiring stub** —
   silently makes any input-context dialog non-functional (state is never initialized). Needs
   test.skip in a relevant test file.

2. `ctx.buttonInputLoop: async () => -1` (io/input-context.ts:157) — **untracked wiring stub** —
   silently cancels all input-context button loops. Needs test.skip in a relevant test file.

3. `ctx.buttonInputLoop: async () => ({ chosenButton: -1, ... })` (ui.ts:306) — **untracked wiring
   stub** (comment says "stub — Phase 7") — silently cancels inventory button loops. Needs
   test.skip in ui.test.ts.

4. `processButtonInput` — the core input handler for all button dialogs; completely untested.
   Handles 3 mouse event types, hotkey lookup across all buttons, cancel-on-outside-click logic,
   and keypress highlight animation. Any regression is silent.

5. `buttonInputLoop` — the top-level event loop; completely untested at the domain level.

## Notes for follow-on initiative

**Buttons.c has zero porting gaps** — all gameplay logic is ported. The entire NEEDS-VERIFICATION
backlog is a testing gap, not a porting gap.

**Three untracked wiring stubs need test.skip entries (Phase 3 cleanup):**
- `initializeButtonState: () => {}` at `io/input-context.ts:156`
- `buttonInputLoop: async () => -1` at `io/input-context.ts:157`
- `buttonInputLoop: async () => (...)` at `ui.ts:306` (tagged "stub — Phase 7")

**smoothHiliteGradient relocation is intentional and correct:**
The function is annotated with its Buttons.c origin in sidebar-player.ts. No porting action needed.
If a dedicated buttons.test.ts is ever added, it should import from `sidebar-player.ts`.

**Priority order for direct tests (follow-on test pass):**
1. `smoothHiliteGradient` — pure math; trivial to test; verify sin curve endpoints (0, 50, 100)
2. `initializeButton` — factory; verify default flags bitmask and color fields are set correctly
3. `initializeButtonState` — verify buttons are deep-copied and window bounds stored
4. `setButtonText` — verify hotkey color escape is injected when KEYBOARD_LABELS is true
5. `processButtonInput` — highest value test; cover mouse-down→mouse-up on button, hotkey press,
   outside-click cancel, and escape-key cancel as separate test cases
6. `drawButtonsInState` — verify drawButton is called for each enabled button
7. `drawButton` — requires ctx mock; verify plotCharToBuffer is called for each character cell
8. `buttonInputLoop` — integration test; provide a mock nextBrogueEvent that fires a keystroke
   matching a button hotkey and verify chosenButton index is returned
