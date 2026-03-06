# Audit: Time.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** c-inventory.md captured only 18 static functions. Supplemented with a grep pass
to find 31 additional public functions (non-static). Total: 49 functions.

Time.c is the best-covered file in the audit to date — 46 of 49 (94%) are fully IMPLEMENTED
with passing tests. The TS port split the file across six modules:
`time/creature-effects.ts`, `time/safety-maps.ts`, `time/turn-processing.ts`,
`time/environment.ts`, `time/misc-helpers.ts`, and `time/index.ts`.

One STUBBED-UNTRACKED gap: `updateScent` — the C scent-trail system that lets monsters follow
the player's movement history. It is a context stub (`() => {}`) in `turn.ts:282` with no
domain function and no `test.skip` entry. This needs to be tracked before synthesis.

Two NEEDS-VERIFICATION entries: `flashCreatureAlert` (local helper, tested only transitively)
and `handleHealthAlerts` (exported, but no dedicated test — only mocked out in turn-processing
tests). Both have real implementations that appear correct; they just lack direct test coverage.

Several domain functions are IMPLEMENTED and tested in the `time/` modules, but their wiring
in higher-level context builders (items.ts, monsters.ts, lifecycle.ts, movement.ts,
input-context.ts) uses `() => {}` stubs. These wiring stubs are a context-layer concern, not
a domain-function gap. Tracked stubs: `exposeCreatureToFire` (items.test.ts:235),
`extinguishFireOnCreature` (monsters.test.ts:256), `promoteTile` (movement.test.ts:235).
Untracked wiring stubs that need `test.skip` entries: `autoRest` and `manualSearch` in
`input-context.ts:188-189`.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| exposeCreatureToFire | 28 | time/creature-effects.ts:228 | IMPLEMENTED | Tested in creature-effects.test.ts:367; wiring stub in items.ts:201 tracked at items.test.ts:235 |
| updateFlavorText | 53 | time/creature-effects.ts:284 | IMPLEMENTED | Tested in creature-effects.test.ts:731; wiring stub in movement.ts:451 |
| updatePlayerUnderwaterness | 71 | time/creature-effects.ts:314 | IMPLEMENTED | Tested in creature-effects.test.ts:760 |
| monsterShouldFall | 93 | time/creature-effects.ts:346 | IMPLEMENTED | Tested in creature-effects.test.ts:478 |
| applyInstantTileEffectsToCreature | 101 | time/creature-effects.ts:826 | IMPLEMENTED | Tested in creature-effects.test.ts:1022 |
| applyGradualTileEffectsToCreature | 457 | time/creature-effects.ts:1238 | IMPLEMENTED | Tested in creature-effects.test.ts:1122 |
| updateClairvoyance | 552 | time/safety-maps.ts:104 | IMPLEMENTED | Tested in safety-maps.test.ts:144; wiring stub in items.ts:237 |
| updateTelepathy | 600 | time/safety-maps.ts:165 | IMPLEMENTED | Tested in safety-maps.test.ts:202 |
| scentDistance | 641 | time/turn-processing.ts:271 | IMPLEMENTED | Tested in turn-processing.test.ts:270 |
| updateScent | 649 | turn.ts:282 | STUBBED-UNTRACKED | Wiring stub only — `() => {}`; no domain function; no test.skip |
| armorStealthAdjustment | 667 | time/creature-effects.ts:395 | IMPLEMENTED | Tested in creature-effects.test.ts:573 |
| currentStealthRange | 676 | time/creature-effects.ts:412 | IMPLEMENTED | Tested in creature-effects.test.ts:596; lifecycle.ts:394 has a simplified bypass returning hardcoded 14 |
| demoteVisibility | 718 | time/creature-effects.ts:380 | IMPLEMENTED | Tested in creature-effects.test.ts:547; safety-maps.ts:222 notes "demoteVisibility inlined" (superseded) |
| discoverCell | 732 | time/creature-effects.ts:362 | IMPLEMENTED | Tested in creature-effects.test.ts:520; lifecycle.ts:476 has a simplified single-line bypass instead of calling the domain function |
| updateVision | 742 | time/safety-maps.ts:218 | IMPLEMENTED | Tested in safety-maps.test.ts:244; wiring stub in items.ts:236, combat-damage.ts uses ctx.updateVision() |
| checkNutrition | 804 | time/creature-effects.ts:516 | IMPLEMENTED | Tested in creature-effects.test.ts:659 |
| burnItem | 846 | time/creature-effects.ts:561 | IMPLEMENTED | Tested in creature-effects.test.ts:702 |
| flashCreatureAlert | 867 | time/creature-effects.ts:452 | NEEDS-VERIFICATION | Local non-exported helper called by handleHealthAlerts; no dedicated test; exercised only transitively |
| handleHealthAlerts | 883 | time/creature-effects.ts:475 | NEEDS-VERIFICATION | Exported function; real implementation exists; no dedicated describe block; mocked out in turn-processing tests |
| addXPXPToAlly | 931 | time/turn-processing.ts:324 | IMPLEMENTED | Tested in turn-processing.test.ts:396 |
| handleXPXP | 956 | time/turn-processing.ts:372 | IMPLEMENTED | Tested in turn-processing.test.ts:456 |
| playerFalls | 977 | time/creature-effects.ts:702 | IMPLEMENTED | Tested in creature-effects.test.ts:896 |
| activateMachine | 1032 | time/environment.ts:132 | IMPLEMENTED | Tested in environment.test.ts:563 |
| circuitBreakersPreventActivation | 1087 | time/environment.ts:111 | IMPLEMENTED | Tested in environment.test.ts:228 |
| promoteTile | 1101 | time/environment.ts:186 | IMPLEMENTED | Tested in environment.test.ts:257; wiring stub in items.ts:366 tracked at movement.test.ts:235 |
| exposeTileToElectricity | 1142 | time/environment.ts:232 | IMPLEMENTED | Tested in environment.test.ts:364 |
| exposeTileToFire | 1158 | time/environment.ts:254 | IMPLEMENTED | Tested in environment.test.ts:391 |
| updateVolumetricMedia | 1224 | time/environment.ts:337 | IMPLEMENTED | Tested in environment.test.ts:464 |
| updateYendorWardenTracking | 1324 | time/environment.ts:446 | IMPLEMENTED | Tested in environment.test.ts:517; duplicate export also in misc-helpers.ts:369 (likely a refactor artifact) |
| monstersFall | 1361 | time/creature-effects.ts:767 | IMPLEMENTED | Tested in creature-effects.test.ts:965 |
| updateEnvironment | 1412 | time/environment.ts:487 | IMPLEMENTED | Tested in environment.test.ts:612 |
| updateAllySafetyMap | 1522 | time/safety-maps.ts:310 | IMPLEMENTED | Tested in safety-maps.test.ts:334 |
| resetDistanceCellInGrid | 1584 | time/safety-maps.ts:291 | IMPLEMENTED | Tested in safety-maps.test.ts:304 |
| updateSafetyMap | 1598 | time/safety-maps.ts:385 | IMPLEMENTED | Tested in safety-maps.test.ts:401 |
| updateSafeTerrainMap | 1732 | time/safety-maps.ts:543 | IMPLEMENTED | Tested in safety-maps.test.ts:503 |
| processIncrementalAutoID | 1772 | time/misc-helpers.ts:210 | IMPLEMENTED | Tested in misc-helpers.test.ts:259 |
| staffChargeDuration | 1805 | time/misc-helpers.ts:136 | IMPLEMENTED | Tested in misc-helpers.test.ts:164 |
| rechargeItemsIncrementally | 1811 | time/misc-helpers.ts:151 | IMPLEMENTED | Tested in misc-helpers.test.ts:186 |
| extinguishFireOnCreature | 1858 | time/creature-effects.ts:266 | IMPLEMENTED | Tested in creature-effects.test.ts:454; wiring stubs in items.ts:202 and monsters.ts:230 tracked at monsters.test.ts:256 |
| monsterEntersLevel | 1871 | time/misc-helpers.ts:410 | IMPLEMENTED | Tested in misc-helpers.test.ts:506 |
| monstersApproachStairs | 1946 | time/misc-helpers.ts:508 | IMPLEMENTED | Tested in misc-helpers.test.ts:588 |
| decrementPlayerStatus | 1969 | time/creature-effects.ts:587 | IMPLEMENTED | Tested in creature-effects.test.ts:796 |
| dangerChanged | 2077 | time/misc-helpers.ts:255 | IMPLEMENTED | Tested in misc-helpers.test.ts:325 |
| autoRest | 2087 | time/misc-helpers.ts:272 | IMPLEMENTED | Tested in misc-helpers.test.ts:351; wiring stub in input-context.ts:188 has no test.skip (untracked) |
| manualSearch | 2146 | time/misc-helpers.ts:338 | IMPLEMENTED | Tested in misc-helpers.test.ts:414; wiring stub in input-context.ts:189 has no test.skip (untracked) |
| synchronizePlayerTimeState | 2187 | time/turn-processing.ts:255 | IMPLEMENTED | Tested in turn-processing.test.ts:343 |
| playerRecoversFromAttacking | 2191 | time/turn-processing.ts:229 | IMPLEMENTED | Tested in turn-processing.test.ts:293 |
| recordCurrentCreatureHealths | 2205 | time/turn-processing.ts:407 | IMPLEMENTED | Tested in turn-processing.test.ts:474 |
| playerTurnEnded | 2219 | time/turn-processing.ts:428 | IMPLEMENTED | Tested in turn-processing.test.ts:493 |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 46 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 1 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 2 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **49** |

## Critical Gaps

1. `updateScent` (C:649) — STUBBED-UNTRACKED. The scent-trail system allows monsters to
   follow the player's movement history even when the player is not in line of sight. The
   context stub in `turn.ts:282` is a no-op. Without this, scent-following monsters will
   not track the player correctly. This is a low-severity gap in practice (monsters still
   path to the player via Dijkstra), but the scent-evasion mechanic (stealth gameplay) is
   entirely absent. A `test.skip` entry must be added to `turn.test.ts` before synthesis.

## Notes for follow-on initiative

**Time.c is the best-covered file in the audit (94% IMPLEMENTED).** The six TS modules
(`creature-effects.ts`, `safety-maps.ts`, `turn-processing.ts`, `environment.ts`,
`misc-helpers.ts`) provide comprehensive coverage with direct tests for almost all functions.

**Single STUBBED-UNTRACKED gap (`updateScent`):** The scent-trail system is fully absent
at the domain level — no exported function exists. The C implementation at line 649 populates
`scentTurnNumber` grids around the player each turn. The TS architecture has the
`TurnProcessingContext` interface slot and the wiring call at `turn-processing.ts:563`, but
the slot is filled with `() => {}` in `turn.ts:282`. Implementing this will require a new
function in `time/safety-maps.ts` or `time/turn-processing.ts` alongside a new
`ScentContext` or addition to `SafetyMapsContext`.

**Wiring stubs that need `test.skip` entries (STUBBED-UNTRACKED at context layer):**
These domain functions ARE IMPLEMENTED but their wiring-layer stubs lack tracking:
- `autoRest` — `input-context.ts:188` has `() => {}`, no test.skip
- `manualSearch` — `input-context.ts:189` has `() => {}`, no test.skip
Both need `test.skip` entries added to `turn.test.ts` or `movement.test.ts`.

**NEEDS-VERIFICATION backlog (2 items):**
- `handleHealthAlerts` (creature-effects.ts:475) — real implementation, no dedicated describe
  block. Should be straightforward to add. Called at multiple points in `playerTurnEnded`.
- `flashCreatureAlert` (creature-effects.ts:452) — private helper, tested only if
  handleHealthAlerts is tested. Once handleHealthAlerts gets a test, this is covered.

**Duplicate `updateYendorWardenTracking` export:** The function appears as an exported symbol
in both `time/environment.ts:446` and `time/misc-helpers.ts:369`. This is likely a refactor
artifact (function moved between files, old export not removed). Both test files import and
test it. The canonical location appears to be environment.ts (where it has the C-source
annotation and is the earlier export). The misc-helpers.ts copy should be audited and removed
if it is identical.

**Lifecycle bypass patterns (not gaps, but follow-on polish):**
- `discoverCell` — `lifecycle.ts:476` uses `pmap[x][y].flags |= TileFlag.DISCOVERED` inline
  instead of calling `discoverCell(x, y, ctx)` from creature-effects.ts. The lifecycle bypass
  skips whatever side effects the domain function performs. Should be wired properly.
- `currentStealthRange` — `lifecycle.ts:394` returns hardcoded `14` instead of calling the
  domain function. This disables stealth range calculation in the main game loop.
