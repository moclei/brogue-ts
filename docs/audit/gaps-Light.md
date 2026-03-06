# Audit: Light.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured only 5 static functions. Supplemented with a public-function
grep pass to find 10 additional functions. Total: 15 functions. TASKS.md estimated ~16 — close
(the discrepancy is `colorMultiplierFromDungeonLight`, which TASKS.md expected to be here but is
annotated as IO.c in the TS source at `io/color.ts:336` and does not appear in the Light.c grep).

Light.c is well-covered structurally: 9 of 15 functions (60%) are IMPLEMENTED with direct tests.
The 5 NEEDS-VERIFICATION functions all have real domain implementations — the gap is test coverage,
not missing code. The TS port split the file across two modules:
`light/light.ts` (lighting math and update loop) and `light/flares.ts` (flare lifecycle and animation).

**The outer animation pipeline has no direct tests.** `updateLighting`, `createFlare`, `animateFlares`,
and `drawFlareFrame` are tested only as mocks in callers (time/, combat/ modules). This is the
primary testing gap for Light.c. These functions exist and appear correctly implemented, but
their behavior is unverified at the domain level.

**`updateLighting` is the most important gap:** it is the main per-turn lighting update that paints
all light sources onto the map and calls `updateDisplayDetail`. It is called from `safety-maps.ts`
as a context callback but the domain function's correctness is untested. Since lighting is a
prerequisite for rendering, this is worth prioritising in the follow-on test pass.

**TASKS.md note on `colorMultiplierFromDungeonLight`:** This function was expected in Light.c but
the C grep found no match. In the TS source, `io/color.ts:336` has a C annotation pointing to
IO.c, not Light.c. It was therefore covered (or flagged as missing) in the IO.c audit session.
No action needed here.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| logLights | 28 | — | OUT-OF-SCOPE | Pure printf debug dump; no equivalent needed in browser port |
| paintLight | 54 | light/light.ts:169 | IMPLEMENTED | Tested in light.test.ts:447 |
| updateMinersLightRadius | 120 | light/light.ts:269 | NEEDS-VERIFICATION | Real impl; domain fn invoked as mock in combat-damage.test.ts:596, creature-effects.test.ts:769; no direct test for the function itself |
| updateDisplayDetail | 156 | light/light.ts:329 | IMPLEMENTED | Tested in light.test.ts:362 |
| backUpLighting | 175 | light/light.ts:90 | IMPLEMENTED | Tested in light.test.ts:273 |
| restoreLighting | 186 | light/light.ts:105 | IMPLEMENTED | Tested in light.test.ts:273 (same describe block as backUpLighting) |
| recordOldLights | 197 | light/light.ts:120 | IMPLEMENTED | Tested in light.test.ts:294 |
| updateLighting | 208 | light/light.ts:383 | NEEDS-VERIFICATION | Real impl; called as context mock in safety-maps.test.ts:257; no direct test for domain function — most critical gap in this file |
| playerInDarkness | 283 | light/light.ts:356 | IMPLEMENTED | Tested in light.test.ts:425 |
| createFlare | 308 | light/flares.ts:82 | NEEDS-VERIFICATION | Real impl; `newFlare` helper (flares.ts:52) is tested; createFlare (game-state mutation) tested only as mock in combat-runics.test.ts:184, creature-effects.test.ts:292 |
| flareIsActive | 321 | light/flares.ts:102 | IMPLEMENTED | Tested in light.test.ts:610 |
| updateFlare | 341 | light/flares.ts:130 | IMPLEMENTED | Tested in light.test.ts:667 |
| drawFlareFrame | 351 | light/flares.ts:145 | NEEDS-VERIFICATION | Real impl; no direct or mock test found; exercised transitively only if animateFlares is called in production |
| animateFlares | 369 | light/flares.ts:195 | NEEDS-VERIFICATION | Real impl; only appears as stub/mock in time tests (creature-effects.test.ts:293, turn-processing.test.ts:235); no domain test |
| deleteAllFlares | 406 | light/flares.ts:249 | IMPLEMENTED | Tested in light.test.ts:717; wired in lifecycle.ts:484,507 |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 9 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 5 |
| OUT-OF-SCOPE | 1 |
| DATA-ONLY | 0 |
| **Total** | **15** |

## Critical Gaps

No MISSING or STUBBED functions. The 5 NEEDS-VERIFICATION items all have real implementations.
Ordered by gameplay impact:

1. `updateLighting` — the main per-turn lighting tick. Called correctly from the time loop
   (safety-maps.ts:269 via context callback), but the domain function's correctness is unverified.
   Lighting is a prerequisite for `getCellAppearance` and all rendering. This should be the first
   domain test added in the follow-on test pass.

2. `animateFlares` — the flare animation loop. Calls `drawFlareFrame` → `paintLight`. Only mocked
   in callers. Flare effects (runic weapon hits, spells) depend on this chain working correctly.

3. `drawFlareFrame` — individual frame rendering for a flare; called only from `animateFlares`.
   Has no test at any level (direct or mock). Low frequency code path but completely unverified.

4. `createFlare` — adds a flare to the game's flare list. The internal object creation helper
   (`newFlare`) is tested; the game-state mutation is not. Low risk (simple append logic).

5. `updateMinersLightRadius` — recalculates the player's light radius based on equipment and
   status. Callers verify it is invoked; the radius calculation itself is unverified.

## Notes for follow-on initiative

**Light.c has no domain-function gaps — all work is testing.** Every C function has a TS
equivalent with real code. The follow-on work is adding direct test describe blocks for the
five NEEDS-VERIFICATION functions.

**Priority order for test additions:**
1. `updateLighting` (light/light.ts:383) — highest priority; the per-turn lighting tick is the
   most complex function in the file and the most critical for rendering correctness.
2. `updateMinersLightRadius` (light/light.ts:269) — straightforward to test; just needs a player
   and rogue state fixture.
3. `createFlare` / `animateFlares` / `drawFlareFrame` (light/flares.ts) — the animation pipeline
   can be tested together: create a flare, animate it, verify the light painted.

**`logLights` is correctly absent.** It was a development debug tool (`printf` to stdout) with no
gameplay function. No browser equivalent is needed.

**`colorMultiplierFromDungeonLight`** is implemented in `io/color.ts:336` with a C annotation
pointing to IO.c. It was not found in the Light.c C grep and is not a Light.c responsibility.
The TASKS.md note was a speculative placement that turned out to be incorrect.

**Wiring is complete for the tested functions.** Unlike Combat.c where several domain functions
had wiring stubs in the production context, Light.c's IMPLEMENTED functions are wired:
- `deleteAllFlares` is directly wired in `lifecycle.ts:484,507`
- `updateLighting` is a context callback in `time/safety-maps.ts`
- `updateMinersLightRadius` is a context callback in combat, time, and items wiring files
The pattern of "real domain function, context callback stub" is present (items.ts:235,
combat.ts:141) but these are callers stubs, not the light functions themselves.
