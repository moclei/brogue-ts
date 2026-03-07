# Audit: Combat.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured only 9 static functions. Supplemented with a public-function
grep pass to find 23 additional functions. Total: 32 functions. TASKS.md estimated ~31 — consistent.

Combat.c is exceptionally well-covered: 30 of 32 functions (94%) are fully IMPLEMENTED with passing
tests. The TS port split the file across five modules:
`combat/combat-math.ts`, `combat/combat-helpers.ts`, `combat/combat-runics.ts`,
`combat/combat-attack.ts`, and `combat/combat-damage.ts`.
Two functions (`strengthModifier`, `netEnchant`) migrated to `items/item-usage.ts` — logical since
they compute item enchantment values used throughout the items system, not just combat.

**Wiring stubs (not function gaps):** Six domain functions are fully IMPLEMENTED and tested but
remain as context no-ops in `combat.ts` (the production wiring file):
`magicWeaponHit: () => {}`, `applyArmorRunicEffect: () => ""`, `specialHit: () => {}`,
`splitMonster: () => {}`, `anyoneWantABite: () => false`, `attackVerb: () => "hits"`.
`combat.ts` lines 8–10 explicitly mark these as "wired in port-v2-platform". These are wiring
gaps, not domain-function gaps. Gameplay impact: weapon runics, armor runics, monster special
hits, jelly splits, and attack verbs are all no-ops at the wiring level until port-v2-platform
connects them.

**Stale test.skip entries (5):** `combat.test.ts` has five `it.skip` entries that predate the
domain implementations and are now stale. They must be removed in the synthesis cleanup pass:
- `combat.test.ts:228` — anyoneWantABite (now IMPLEMENTED in combat-helpers.ts:523)
- `combat.test.ts:255` — attackVerb (domain fn exists; stale stub description)
- `combat.test.ts:261` — magicWeaponHit (now IMPLEMENTED in combat-runics.ts:205)
- `combat.test.ts:267` — applyArmorRunicEffect (now IMPLEMENTED in combat-runics.ts:383)
- `combat.test.ts:272` — specialHit (now IMPLEMENTED in combat-runics.ts:102)

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| strengthModifier | 60 | items/item-usage.ts:89 | IMPLEMENTED | Tested in item-usage.test.ts:172; placed in items module — used widely beyond combat |
| netEnchant | 69 | items/item-usage.ts:113 | IMPLEMENTED | Tested in item-usage.test.ts:205; placed in items module for same reason |
| monsterDamageAdjustmentAmount | 78 | combat/combat-math.ts:68 | IMPLEMENTED | Tested in combat-math.test.ts:104 |
| monsterDefenseAdjusted | 87 | combat/combat-math.ts:92 | IMPLEMENTED | Tested in combat-math.test.ts:143 |
| monsterAccuracyAdjusted | 98 | combat/combat-math.ts:116 | IMPLEMENTED | Tested in combat-math.test.ts:178 |
| hitProbability | 105 | combat/combat-math.ts:140 | IMPLEMENTED | Tested in combat-math.test.ts:210 |
| attackHit | 136 | combat/combat-math.ts:204 | IMPLEMENTED | Tested in combat-math.test.ts:318 |
| addMonsterToContiguousMonsterGrid | 148 | combat/combat-helpers.ts:368 | IMPLEMENTED | Private helper; exercised via splitMonster tests |
| alliedCloneCount | 167 | combat/combat-helpers.ts:345 | IMPLEMENTED | Private helper; exercised via splitMonster tests |
| splitMonster | 208 | combat/combat-helpers.ts:406 | IMPLEMENTED | Tested in combat-helpers.test.ts:340; wiring stub in combat.ts:220 (pending port-v2-platform) |
| moralAttack | 316 | combat/combat-attack.ts:266 | IMPLEMENTED | Tested in combat-attack.test.ts:295 |
| handlePaladinFeat | 357 | combat/combat-helpers.ts:204 | IMPLEMENTED | Tested in combat-helpers.test.ts:192 |
| playerImmuneToMonster | 369 | combat/combat-helpers.ts:235 | IMPLEMENTED | Tested in combat-helpers.test.ts:246 |
| specialHit | 382 | combat/combat-runics.ts:102 | IMPLEMENTED | Tested in combat-runics.test.ts:204; wiring stub in combat.ts:219 (pending port-v2-platform); stale test.skip at combat.test.ts:272 |
| forceWeaponHit | 498 | combat/combat-runics.ts (context interface) | NEEDS-VERIFICATION | No standalone domain function; refactored into DI context callback; called at combat-runics.ts:335; tested via mock at combat-runics.test.ts:195,377 |
| magicWeaponHit | 591 | combat/combat-runics.ts:205 | IMPLEMENTED | Tested in combat-runics.test.ts:300; wiring stub in combat.ts:217 (pending port-v2-platform); stale test.skip at combat.test.ts:261 |
| attackVerb | 788 | combat/combat-helpers.ts:299 | NEEDS-VERIFICATION | Real implementation exists; no dedicated test block; wiring stub in combat.ts:223 (returns "hits"); stale test.skip at combat.test.ts:255 |
| applyArmorRunicEffect | 808 | combat/combat-runics.ts:383 | IMPLEMENTED | Tested in combat-runics.test.ts:422; wiring stub in combat.ts:218 (pending port-v2-platform); stale test.skip at combat.test.ts:267 |
| decrementWeaponAutoIDTimer | 983 | combat/combat-helpers.ts:260 | IMPLEMENTED | Tested in combat-helpers.test.ts:298 |
| processStaggerHit | 999 | combat/combat-attack.ts:221 | IMPLEMENTED | Tested in combat-attack.test.ts:199 |
| attack | 1017 | combat/combat-attack.ts:333 | IMPLEMENTED | Tested in combat-attack.test.ts:429 |
| strLenWithoutEscapes | 1276 | combat/combat-helpers.ts:114 | IMPLEMENTED | Tested in combat-helpers.test.ts:95 |
| combatMessage | 1293 | combat/combat-helpers.ts (CombatMessageBuffer.addMessage) | IMPLEMENTED | Implemented as CombatMessageBuffer class; tested in combat-helpers.test.ts:125; wiring context uses combatMessage: () => {} stub (pending port-v2-platform) |
| displayCombatText | 1327 | combat/combat-helpers.ts (CombatMessageBuffer.flush) | IMPLEMENTED | Same class as combatMessage; flush() tested in combat-helpers.test.ts:125 |
| flashMonster | 1355 | combat/combat-damage.ts:145 | IMPLEMENTED | Tested in combat-damage.test.ts:95 |
| canAbsorb | 1367 | combat/combat-helpers.ts:648 | IMPLEMENTED | Private helper; exercised via anyoneWantABite tests |
| anyoneWantABite | 1401 | combat/combat-helpers.ts:523 | IMPLEMENTED | Tested in combat-helpers.test.ts:420; wiring stub in combat.ts:129 (always returns false); stale test.skip at combat.test.ts:228 |
| inflictLethalDamage | 1515 | combat/combat-damage.ts:180 | IMPLEMENTED | Tested in combat-damage.test.ts:283 |
| inflictDamage | 1521 | combat/combat-damage.ts:210 | IMPLEMENTED | Tested in combat-damage.test.ts:142 |
| addPoison | 1615 | combat/combat-damage.ts:359 | IMPLEMENTED | Tested in combat-damage.test.ts:307 |
| killCreature | 1642 | combat/combat-damage.ts:404 | IMPLEMENTED | Tested in combat-damage.test.ts:377 |
| buildHitList | 1744 | combat/combat-attack.ts:154 | IMPLEMENTED | Tested in combat-attack.test.ts:141 |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 30 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 2 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **32** |

## Critical Gaps

**No critical gaps.** There are no MISSING or STUBBED functions in Combat.c. All 32 C functions
have TS equivalents with real implementations. The two NEEDS-VERIFICATION items are minor:

1. `attackVerb` — domain function exists in combat-helpers.ts:299 but has no dedicated test block.
   The wiring stub `() => "hits"` in combat.ts means players see generic attack messages in gameplay.
   Low risk to fix: add one test describe block and wire the real function.

2. `forceWeaponHit` — the C static function was refactored into a DI context callback rather than
   a standalone domain function. The call site in `magicWeaponHit` correctly delegates to
   `ctx.forceWeaponHit()`, and the test mock verifies it is invoked. The actual implementation
   (opening doors, moving boulders on force-weapon hit) lives in the items/environment system.
   Needs human review to confirm the correct implementation hook exists in that system.

## Notes for follow-on initiative

**Combat.c is the second-best-covered file in the audit** (tied with Time.c at 94% IMPLEMENTED).
Every core combat mechanic — hit resolution, damage, poison, death, runic effects, jelly splitting,
absorption, paladin feat, weapon auto-ID — has a working domain implementation with passing tests.

**The primary follow-on work is wiring, not implementation.** Six domain functions are stubs in
`combat.ts` pending port-v2-platform:
- `magicWeaponHit`, `applyArmorRunicEffect`, `specialHit` — weapon/armor runic effects
- `splitMonster` — jelly/multiplicity splitting on hit
- `attackVerb` — attack flavor text (currently always "hits")
- `anyoneWantABite` — monster absorption on death (currently always false)

These six stubs mean that in the current build, weapon enchantments, armor runics, and monster
special attacks are all silently disabled. Runics are probably the highest-priority combat wiring
gap since they affect strategic item decisions.

**Stale test.skip cleanup (5 entries) is mandatory before synthesis closes:**
All five entries in `combat.test.ts` (lines 228, 255, 261, 267, 272) describe functions that are
now IMPLEMENTED in the dedicated combat modules. Keeping them creates a false impression that the
functions are unimplemented.

**`strengthModifier` and `netEnchant` placement is correct.** Both functions use the player's
`weaknessAmount` and item `enchant1` values — data that the items system owns. Placing them in
`items/item-usage.ts` (rather than a combat module) is the right architectural choice.

**`attackVerb` is the only action item from NEEDS-VERIFICATION:** add a test describe block in
`combat-helpers.test.ts` to verify it selects the correct verb from the monster text table based
on damage percentile. The existing implementation logic in `combat-helpers.ts:299` appears
complete — it's a direct translation of the C selection algorithm.
