# Port Parity Audit — Plan

## Approach

Three phases: classify, wire, verify.

### Phase 1: Classify

Use the analysis tools (not manual reading) to categorize every stub:

- **Mechanical wire-up** — the function is already implemented in some
  TS context builder(s) but stubbed in others. Fix: replicate the real
  wiring. This is the majority of stubs.
- **Needs porting** — the function has no real TS implementation
  anywhere. Fix: port from C source.
- **Recording/persistence** — skip. Documented in `docs/BACKLOG.md`.
- **Intentional gap** — documented acceptable divergence. Skip.

The classification method for each unique stub name:

1. Grep for `FUNCNAME:` or `FUNCNAME(` across `rogue-ts/src/` excluding
   the known stub patterns. If a non-stub assignment exists, it's a
   mechanical wire-up.
2. If no non-stub assignment exists, check the C manifest
   (`c-manifest.json`) for the function's system and callers. If it's
   on a critical path, it needs porting. If not, it may be an
   acceptable gap.

Output: a classification table appended to this file or stored in
`docs/analysis/stub-classification.json`.

### Phase 2: Wire stubs

Work builder-by-builder through context builders, ordered by stub count
(most-stubbed first). For each builder:

1. Read the builder's stub list from `stub-report.json`
2. Skip recording/persistence and intentional-gap stubs
3. For mechanical wire-ups: find the real implementation, replicate it
4. For needs-porting: read the C source via the manifest, implement,
   wire
5. Run `npx vitest run` — no regressions
6. Re-run the scanner: `cd tools/analysis && npx tsx scan-stubs.ts`
7. Commit

**Priority builders** (from `PORT_HEALTH.md`):

| Builder | File | Stubs |
|---------|------|------:|
| `buildApplyInstantTileEffectsFn` | `tile-effects-wiring.ts` | 44 |
| `buildTurnProcessingContext` | `turn.ts` | 34 |
| `buildInputContext` | `io/input-context.ts` | 33 |
| `buildMonsterZapFn` | `turn-monster-zap-wiring.ts` | 28 |
| `buildThrowCommandFn` | `items/item-commands.ts` | 27 |
| `buildStaffZapFn` | `items/staff-wiring.ts` | 27 |

After the top 6, continue with remaining builders in descending stub
count order.

### Phase 3: Verify and close

- Re-run the full analysis pipeline
- Review `PORT_HEALTH.md` — critical stub count should be near zero
  (only recording/persistence and documented gaps remaining)
- Playtest on a known seed to validate feel and behavior
- Update `docs/BACKLOG.md` with final status

---

## Technical Notes

### Why stubs exist

The DI/context-builder pattern requires each domain module to provide
all the functions a code path might call. When function X is ported and
wired into context builder A, the other 7 builders that also need X
aren't automatically updated. Playtesting found and fixed stubs on the
main paths but left secondary paths (staff effects, monster zap, tile
effects, etc.) still stubbed.

### Wiring pattern

Most stubs look like:
```typescript
refreshDungeonCell: () => {},
```

The real implementation (in another builder) looks like:
```typescript
refreshDungeonCell: (x, y) => {
    refreshDungeonCellFn(x, y, pmap, tmap, ...);
},
```

The fix is to ensure the stubbed builder has access to the same
dependencies (pmap, tmap, etc.) and replicate the call. If dependencies
aren't available in scope, they may need to be threaded in from the
builder's parent function parameters.

### File size constraint

Several wiring files are already close to 600 lines. Wiring 20-40 stubs
in one file may push it over. Be prepared to split context builders
into focused sub-builders (e.g., `tile-effects-wiring.ts` →
`tile-effects-wiring.ts` + `tile-effects-combat-ctx.ts`).

---

## Phase 1 Classification Results

### Classification Summary

| Category | Count | % |
|---|---:|---:|
| wire-up | 132 | 60% |
| needs-porting | 79 | 36% |
| recording | 6 | 3% |
| intentional-gap | 3 | 1% |
| **Total unique stubs** | **220** | |

**wire-up** — real implementation exists in at least one builder; fix is mechanical replication.
**needs-porting** — no real TS implementation anywhere; requires reading C source and writing new code.
**recording** — `recordKeystroke`, `recordMouseClick`, `flushBufferToFile`, `RNGCheck`, `assureCosmeticRNG`, `restoreRNG` — deferred to port-v2-persistence initiative.
**intentional-gap** — `takeScreenshot`, `isApplicationActive`, `initializeLaunchArguments` — platform-specific, documented in `docs/BACKLOG.md`.

### Needs-Porting Breakdown by Effort

| Tier | Count | Functions |
|---|---:|---|
| high | 2 | `fillGrid` (30 callers), `becomeAllyWith` (7 callers) |
| medium | 52 | critical-path functions, ≤5 callers each (see JSON) |
| low | 0 | — |
| defer | 18 | recording/persistence overlap — skip until port-v2-persistence |
| unknown | 7 | helper flags/setters; needs C source review |

Notable medium-tier functions spanning multiple systems: `splitMonster`, `handlePaladinFeat`, `monstersFall`, `killCreature`, `specialHit`, `refreshWaypoint`, `analyzeMap`, `deleteMessages`, `vomit`, `weaken`, `polymorph`.

### Revised Effort Estimate for Phase 2

**Key insight from classification:** the 132 wire-up stubs are mechanically parallelizable — each builder is independent. The 79 needs-porting stubs are the harder work and are prerequisites for wiring (builders can't reference a function that doesn't exist yet).

Recommended ordering:

1. **Port first (new sub-phase 2a):** implement the high/medium needs-porting functions before touching any builder. Start with `fillGrid` (blocks `freeGrid`, which appears in 4 builders) and `becomeAllyWith` (movement system). Then work through medium-tier in system order: combat → monsters → items → turn → io → dungeon-gen.
2. **Wire builders (sub-phase 2b):** once ported functions exist, work builder-by-builder in descending stub-count order. The top 6 builders account for 193 stub occurrences (~40% of all 482 total occurrences).
3. **Defer 18 recording/persistence stubs** throughout — mark clearly, do not implement.

The original Phase 4 (drift investigation) is still needed; Phase 1 classification found no evidence of intentional simplification but did not check for behavioral drift — that requires C-vs-TS comparison.

### Open Questions Resolved

| Question | Answer |
|---|---|
| How many stubs are mechanical wire-ups vs needs-porting? | 132 wire-up (60%), 79 needs-porting (36%), 9 deferred/gap (4%) |
| Are there drifted implementations? | Not answered by Phase 1 — Phase 4 (drift investigation) still required |

---

## Rejected Approaches

_(append-only — do not clean up)_

---

## Session Notes [2026-03-31]

### Phase 4 — Simplified Implementation Scan

Total markers found: 21 (after excluding DEFER/permanent-defer/port-v2-persistence comments).

#### Summary table

| Finding | File | Category | Status |
|---|---|---|---|
| `monsterCatalog: []` stub in `buildMinimalCombatContext` | `turn-combat-helpers.ts:196` | Gameplay-critical | **Fixed** |
| `monsterCatalog: []` stub in `buildApplyInstantTileEffectsFn` combat ctx | `tile-effects-wiring.ts:305` | Gameplay-critical | **Fixed** |
| `burnedTerrainFlagsAtLoc` approximation (hardcoded flags instead of catalog lookup) | `state/helpers.ts:165` | Monster AI (fire avoidance) | **Deferred** |
| `traversiblePathBetween` docstring said "Bresenham-style" (stale comment) | `monsters/monster-actions.ts:291` | Stale comment only | **Fixed** (comment corrected) |
| `executeMouseClick` — left-click always travels, C version shows cursor mode loop without controlKey | `io/input-mouse.ts:48` | Visual/UX | **Documented** |
| `monsterName` — hallucination random names use `cosmeticRandRange` but catalog deferred | `monsters/monster-queries.ts:267` | Visual-only | Already handled (cosmetic RNG deferred) |
| `pauseAnimation: () => false` | `io/misc-helpers-context.ts:341` | Visual-only | Pre-existing stub |
| Various `animateFlares: () => {}` stubs | `turn-env-wiring.ts:279` | Visual-only | Pre-existing stub |
| `confirmMessages: () => {}` in turn ctx | `turn.ts:215` | UI sequencing | Pre-existing stub |
| Other stubs (eat, playerTurnEnded re-entry guard, etc.) | various | Pre-existing documented stubs | No change |

#### Gameplay-critical fixes

**`monsterCatalog: []` (2 locations)**
- Impact: `combat-damage.ts:469` accesses `ctx.monsterCatalog[decedent.info.monsterID].abilityFlags` without null guard. With empty array, this throws a runtime error when an ally dies out of sight (checking `MA_ENTER_SUMMONS` flag for "sense of loss" message). Also affects `splitMonster` in `combat-helpers.ts` (has null guard, so safe but returns wrong flags).
- Fix: `turn-combat-helpers.ts` — added `getGameState` import, replaced `[]` with `getGameState().monsterCatalog`. `tile-effects-wiring.ts` — `monsterCatalog` was already destructured from `getGameState()` at line 122; removed duplicate `[]` stub.

#### Deferred

**`burnedTerrainFlagsAtLoc` approximation**
- C uses `successorTerrainFlags(tile, SUBSEQ_BURN)` → looks up `tileCatalog[tile].fireType`, then returns `tileCatalog[dungeonFeatureCatalog[DF].tile].flags`.
- TS approximates: `T_IS_FIRE | T_CAUSES_DAMAGE` (+ `T_CAUSES_EXPLOSIVE_DAMAGE` for explosive promoters).
- Impact: practically zero — all flammable tiles in the catalog use `DF_PLAIN_FIRE` or `DF_EMBERS`, both of which produce fire terrain with exactly those flags. The approximation is correct for all current tile types.
- Fix path if ever needed: add `dungeonFeatureCatalog` parameter to `burnedTerrainFlagsAtLoc` and all 4 call sites.

**`executeMouseClick` cursor mode**
- C: left-click without `controlKey` sets `rogue.cursorLoc` and calls `mainInputLoop()` (cursor mode).
- TS: always calls `travel()` directly (architectural decision documented in file header — Port V2 outer loop lives in `platform.ts`).
- Impact: UX only — cursor mode is a display feature. Travel behavior is the same.
- Status: intentional architectural deviation, not a bug.

#### Visual-only / already-handled (count only): 7 items

#### Test results
- Pre-existing failures: 2 (sprite-renderer tests, unrelated to these changes)
- Tests passing: 2730 | skipped: 54

---

### Phase 4 — Behavioral Parity Spot-Check

Functions reviewed: `attack` (Combat.c:1017), `inflictDamage` (Combat.c:1521), `applyInstantTileEffectsToCreature` (Time.c:101), `updateEnvironment` (Time.c:1412).

#### Summary table

| Function | System | Assessment | Key Finding |
|---|---|---|---|
| `attack` | combat | **Behavioral drift (4 bugs fixed)** | See details below |
| `inflictDamage` | combat | **Match** | Shield reduction, transference, flee threshold all faithful |
| `applyInstantTileEffectsToCreature` | turn/tiles | **Behavioral drift (1 bug fixed)** | Missing DF_CREATURE_FIRE on lava monster kill |
| `updateEnvironment` | turn/env | **Match** | Two-pass promotion, fire spread, gas update all faithful |

#### Behavioral drift — `attack` (4 issues)

**1. `applyArmorRunicEffect` damage not applied (Critical)**
- C: `applyArmorRunicEffect(armorRunicString, attacker, &damage, true)` — passes `&damage` by pointer; the function mutates it (e.g. Absorption reduces it, Immunity zeroes it, Vulnerability doubles it).
- TS (before fix): `ctx.applyArmorRunicEffect(attacker, { value: damage }, true)` — creates a temporary object; `damage` local is never updated from the object after the call.
- Impact: armor runics Absorption, Immunity, Mutuality, and Vulnerability all had no effect on actual damage inflicted during melee attacks.
- Fix: `combat-attack.ts:502` — store object ref, read back `damage = damageRef.value` after call.

**2. Dragonslayer feat never set (Critical)**
- C: `if (&player == attacker && defender->info.monsterID == MK_DRAGON)` — MK_DRAGON is enum value ~42.
- TS (before fix): `if (attacker === ctx.player && defender.info.monsterID === 0)` — `0` is `MK_YOU` (the player), not MK_DRAGON. Condition was always false for any dragon kill.
- Fix: `combat-attack.ts:582` — changed to `defender.info.monsterID === MonsterType.MK_DRAGON`.

**3. A_BURDEN `strengthCheck` never called (Minor)**
- C: after showing armor runic message, calls `strengthCheck(rogue.armor, true)` if `enchant2 == A_BURDEN` (value 8).
- TS (before fix): condition was `ctx.armor.enchant2 === 0` (Multiplicity), so always false for Burden armor.
- Impact: Burden armor of strength requirement increase after hits would not trigger the strength failure check.
- Fix: `combat-attack.ts:621` — changed to `ctx.armor.enchant2 === ArmorEnchant.Burden`.

**4. W_SLAYING weapon degradation bypass never triggered (Minor)**
- C: weapon of Slaying against its slaying class is exempt from acid mound degradation; `enchant2 == W_SLAYING` (value 7).
- TS (before fix): condition was `ctx.weapon.enchant2 === 0` (Speed), always false for Slaying weapons.
- Impact: a Slaying weapon attacking its target class could be degraded by an acid mound when it should be immune.
- Fix: `combat-attack.ts:654` — changed to `ctx.weapon.enchant2 === WeaponEnchant.Slaying`.

#### Behavioral drift — `applyInstantTileEffectsToCreature` (1 issue)

**Missing DF_CREATURE_FIRE spawn on lava monster kill**
- C: after `killCreature(monst, false)`, calls `spawnDungeonFeature(*x, *y, &dungeonFeatureCatalog[DF_CREATURE_FIRE], true, false)`.
- TS (before fix): called `killCreature` and `refreshDungeonCell` but skipped the fire spawn.
- Impact: monsters killed by lava did not produce the fire visual effect on their tile.
- Fix: `creature-effects.ts:925` — added `ctx.spawnDungeonFeature(x, y, ctx.dungeonFeatureCatalog[DungeonFeatureType.DF_CREATURE_FIRE], true, false)`.

#### `inflictDamage` — Match

- Shield reduction: C uses `(status + 9) / 10` (ceiling division); TS uses `Math.ceil(status / 10)` — equivalent ✓
- Transference: player, ally (40%), enemy (90%) fractions all match ✓
- Flee-near-death: `maxHP / 4 >= currentHP` threshold faithful ✓
- Easy mode: `max(1, damage/5)` ✓
- Blood spawning: `15 + min(damage, currentHP) * 3 / 2` probability scale faithful ✓

#### `updateEnvironment` — Match

- Two-pass promotion (mark then promote) ✓
- Fire spread (4-cardinal neighbors) ✓
- Gas double-update ✓
- Pressure plate release, key-activated promotions ✓
- `updateFloorItems` call at end ✓

#### Test results
- Tests passing: 2730 | skipped: 54 | failed: 2 (pre-existing sprite-renderer, unrelated)
- No regressions introduced by fixes.

## Open Questions

- How many stubs are truly "mechanical wire-ups" vs "needs porting"?
  Phase 1 classification will answer this.
- Are there functions that are implemented but subtly wrong (behavioral
  drift)? The stub scanner can't detect this — it only finds missing
  implementations. Drift detection may require seed-based comparison or
  targeted C-vs-TS behavioral tests.
