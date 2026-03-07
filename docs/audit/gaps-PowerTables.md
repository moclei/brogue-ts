# Audit: PowerTables.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured zero functions (all public, no statics; inventory script only
captures `static` definitions). Supplemented with two grep passes: (1) the TASKS.md public-function
grep (found 13 multi-line definitions), and (2) a broader `^[a-zA-Z]` grep that captured 21 one-liner
inline definitions that the TASKS.md grep filtered out via `grep -v ";"`. Total: 34 public functions.
TASKS.md estimate of ~34 was correct.

TASKS.md note "Likely DATA-ONLY" is **incorrect**. PowerTables.c contains no data tables — it is
entirely computation functions: enchantment-scaling formulas for staves, rings, weapons, armor,
charms, wands, and attack fractions. The "power tables" are computed via fixed-point arithmetic, not
lookup arrays.

All 34 functions have real implementations in `rogue-ts/src/power/power-tables.ts`. The file has a
dedicated test suite (`tests/power-tables.test.ts`) that directly tests 27 of 34 functions.

**Key finding:** 12 functions are fully IMPLEMENTED (tested + wired into production code). The
remaining 22 are NEEDS-VERIFICATION: they have real implementations (and most have direct tests) but
are either (a) never imported outside `power-tables.ts`, meaning the items/monster code that would
call them has not yet connected them, or (b) wired in context builders but lack direct tests. No
functions are MISSING or STUBBED.

`staffBlinkDistance` is a notable case: the domain function is correctly implemented and tested, but
the items.ts context wiring hard-codes `() => 0` (with comment "stub — wired in port-v2-platform")
instead of calling the real function. Staff of blinking distance will always be zero at runtime.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| wandDominate | 45 | power/power-tables.ts:533 | NEEDS-VERIFICATION | Tested in power-tables.test.ts; never imported outside power-tables.ts — wand of domination not wired |
| staffDamageLow | 49 | power/power-tables.ts:38 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — staff damage range not wired |
| staffDamageHigh | 50 | power/power-tables.ts:42 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — staff damage range not wired |
| staffDamage | 51 | power/power-tables.ts:46 | NEEDS-VERIFICATION | Not in power-tables.test.ts; never imported — staff damage roll not wired |
| staffBlinkDistance | 52 | power/power-tables.ts:54 | NEEDS-VERIFICATION | Tested; items.ts context stubs as `() => 0` instead of calling real fn — blink range always 0 |
| staffHasteDuration | 53 | power/power-tables.ts:58 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — haste duration not wired |
| staffBladeCount | 54 | power/power-tables.ts:62 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — blade count not wired |
| staffDiscordDuration | 55 | power/power-tables.ts:66 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — discord duration not wired |
| staffEntrancementDuration | 56 | power/power-tables.ts:70 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — enticement duration not wired |
| staffProtection | 57 | power/power-tables.ts:74 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — protection staff not wired |
| staffPoison | 60 | power/power-tables.ts:93 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — poison staff not wired |
| ringWisdomMultiplier | 72 | power/power-tables.ts:111 | IMPLEMENTED | Wired via ctx.ringWisdomMultiplier in time/misc-helpers.ts; tested in power-tables.test.ts |
| charmHealing | 83 | power/power-tables.ts:482 | NEEDS-VERIFICATION | Wired in items.ts context; no direct test in power-tables.test.ts |
| charmShattering | 84 | power/power-tables.ts:489 | NEEDS-VERIFICATION | Wired in items.ts context; no direct test |
| charmGuardianLifespan | 85 | power/power-tables.ts:496 | NEEDS-VERIFICATION | Never imported outside power-tables.ts; no direct test |
| charmNegationRadius | 86 | power/power-tables.ts:503 | NEEDS-VERIFICATION | Wired in items.ts context; no direct test |
| charmProtection | 87 | power/power-tables.ts:317 | IMPLEMENTED | Wired in items.ts context (item-handlers.ts:1147); tested in power-tables.test.ts |
| weaponParalysisDuration | 99 | power/power-tables.ts:121 | IMPLEMENTED | Direct import in combat-runics.ts:295; tested in power-tables.test.ts |
| weaponConfusionDuration | 100 | power/power-tables.ts:125 | IMPLEMENTED | Direct import in combat-runics.ts:325; tested in power-tables.test.ts |
| weaponForceDistance | 101 | power/power-tables.ts:129 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — force-distance runic not wired |
| weaponSlowDuration | 102 | power/power-tables.ts:133 | IMPLEMENTED | Direct import in combat-runics.ts:315; tested in power-tables.test.ts |
| weaponImageCount | 103 | power/power-tables.ts:137 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — mirror-image runic not wired |
| weaponImageDuration | 104 | power/power-tables.ts:141 | NEEDS-VERIFICATION | Tested (always returns 3); never imported — mirror-image runic not wired |
| armorReprisalPercent | 106 | power/power-tables.ts:149 | IMPLEMENTED | Direct import in combat-runics.ts:476; tested in power-tables.test.ts |
| armorAbsorptionMax | 107 | power/power-tables.ts:153 | IMPLEMENTED | Direct import in combat-runics.ts:459; tested in power-tables.test.ts |
| armorImageCount | 108 | power/power-tables.ts:157 | IMPLEMENTED | Direct import in combat-runics.ts:409; tested in power-tables.test.ts |
| reflectionChance | 109 | power/power-tables.ts:185 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — ring of protection/reflection not wired |
| turnsForFullRegenInThousandths | 125 | power/power-tables.ts:203 | NEEDS-VERIFICATION | Tested; never imported outside power-tables.ts — ring of regeneration not wired |
| damageFraction | 138 | power/power-tables.ts:244 | IMPLEMENTED | Direct import in combat-math.ts:73, item-usage.ts:272; tested in power-tables.test.ts |
| accuracyFraction | 161 | power/power-tables.ts:255 | IMPLEMENTED | Direct import in combat-math.ts:118; tested in power-tables.test.ts |
| defenseFraction | 184 | power/power-tables.ts:293 | IMPLEMENTED | Direct import in combat-math.ts:180; tested in power-tables.test.ts |
| charmEffectDuration | 206 | power/power-tables.ts:510 | NEEDS-VERIFICATION | Wired in items.ts context (lines 260-261); no direct test (only mocked in misc-helpers.test.ts) |
| charmRechargeDelay | 212 | power/power-tables.ts:518 | NEEDS-VERIFICATION | Wired in items.ts and misc-helpers.ts contexts; no direct test (only mocked) |
| runicWeaponChance | 220 | power/power-tables.ts:551 | IMPLEMENTED | Direct import in combat-runics.ts:235; tested in power-tables.test.ts |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 12 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 22 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **34** |

## Critical Gaps

None. No functions are MISSING or STUBBED-UNTRACKED.

However, the NEEDS-VERIFICATION backlog is large (22 functions). The most significant unwired
functions by gameplay impact:

1. `staffBlinkDistance` — context stub returns 0; staff of blinking teleports the minimum distance
2. `staffProtection` / `staffPoison` — staff protection/poison values never computed; item effects
   broken
3. `reflectionChance` — ring of protection from projectiles non-functional
4. `turnsForFullRegenInThousandths` — ring of regeneration speed unaffected by enchantment
5. `wandDominate` — domination probability always falls back to 0; wand effect broken
6. `weaponForceDistance` / `weaponImageCount` — two weapon runics (force, mirror-image) unconnected
7. `charmHealing` / `charmShattering` / `charmNegationRadius` / `charmGuardianLifespan` — charm
   magnitudes wired but never validated against C reference output

## Notes for follow-on initiative

**No fix work required for test.skip compliance** (zero STUBBED-UNTRACKED). The Phase 3 synthesis
task for adding test.skip entries does not apply to PowerTables.c.

**The 22 NEEDS-VERIFICATION items split into two groups:**

1. *Tested but unwired* (15 functions): The domain functions are correctly implemented and tested
   directly against expected output. The gap is that no production code imports them. These represent
   item/monster code that exists on the TS side but has not yet connected the scaling formula. The
   fix is straightforward: import and call the correct `power-tables.ts` function from the relevant
   item-handler or context builder. Highest priority: `staffBlinkDistance` (context stub must be
   replaced), staff duration functions, `reflectionChance`, `turnsForFullRegenInThousandths`,
   `wandDominate`.

2. *Wired but untested* (7 functions): `charmHealing`, `charmShattering`, `charmGuardianLifespan`,
   `charmNegationRadius`, `charmEffectDuration`, `charmRechargeDelay` (all wired in items.ts context
   builders) plus `ringWisdomMultiplier` (IMPLEMENTED — excluded). These lack direct tests in
   `power-tables.test.ts`. The implementations look plausible but have not been cross-validated
   against C reference output. Adding tests following the pattern in `rng.test.ts` (compile C, record
   reference values, assert exact match) would move them to IMPLEMENTED.

**`staffBlinkDistance` context stub is the single most actionable item**: `items.ts:242` must be
updated to call `staffBlinkDistance(enchant)` from `power-tables.ts`. The domain function is already
implemented and tested — only the wiring lambda needs to change.
