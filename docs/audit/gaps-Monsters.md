# Audit: Monsters.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** c-inventory.md captured only 38 static functions. Supplemented with two grep
passes to find ~76 additional public functions (non-static, special return types). Total: 114
functions. Creature-list iterator functions (createCreatureList, iterateCreatures, etc.) are
OUT-OF-SCOPE because the TS port uses plain JS arrays throughout. Monster AI spell/bolt casting
pipeline is largely MISSING (monsterCastSpell, monstUseBolt, getSafetyMap, allyFlees,
creatureEligibleForSwarming, monsterSwarmDirection, etc.) — monsters will not cast spells or
use ally-flee logic.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| attackWouldBeFutile | 297 | monsters/monster-queries.ts:314 | IMPLEMENTED | Tested in monster-queries.test.ts:391 |
| spawnMinions | 694 | monsters/monster-spawning.ts:282 | IMPLEMENTED | Tested indirectly via spawnHorde in monsters.test.ts |
| drawManacle | 758 | — | MISSING | Single-cell manacle terrain drawing; no TS equivalent |
| drawManacles | 771 | monsters.ts:141 (ctx stub) | STUBBED-UNTRACKED | `() => {}` in monsters.ts wiring; no test.skip |
| summonMinions | 976 | monsters/monster-actions.ts:131 (ctx iface) | MISSING | Context interface only; no standalone implementation |
| isValidWanderDestination | 1197 | monsters/monster-actions.ts:247 | NEEDS-VERIFICATION | No direct test; used only as mock in monster-actions.test.ts |
| closestWaypointIndex | 1205 | monsters.ts:210 (ctx stub) | STUBBED-TRACKED | monsters.test.ts:238 |
| successorTerrainFlags | 1251 | state/helpers.ts:143 (callback param) | NEEDS-VERIFICATION | Passed as callback in discoveredTerrainFlagsAtLoc; no standalone fn |
| moveMonsterPassivelyTowards | 1515 | monsters/monster-movement.ts:774 | NEEDS-VERIFICATION | Function exists; no direct test |
| monsterCanShootWebs | 1608 | turn.ts:337 (ctx stub) | STUBBED-UNTRACKED | `() => false`; no test.skip |
| awarenessDistance | 1621 | — | MISSING | Internal helper for awareOfTarget; not ported as standalone fn |
| awareOfTarget | 1649 | monsters.ts:219 (ctx stub) | STUBBED-TRACKED | monsters.test.ts:244 |
| closestWaypointIndexTo | 1685 | monsters.ts:211 (ctx stub) | STUBBED-TRACKED | monsters.test.ts:268 |
| wanderToward | 1699 | monsters/monster-actions.ts:291 | NEEDS-VERIFICATION | No direct test; used only as mock |
| monsterHasBoltEffect | 2079 | turn.ts:333 (ctx stub) | STUBBED-UNTRACKED | `() => 0`; no test.skip |
| pathTowardCreature | 2089 | monsters/monster-actions.ts:402 | NEEDS-VERIFICATION | Function exists; wiring stubbed (turn.test.ts:186) |
| creatureEligibleForSwarming | 2134 | — | MISSING | Swarming eligibility check; no TS equivalent |
| monsterSwarmDirection | 2160 | monsters/monster-movement.ts:448 (ctx iface) | MISSING | Context interface only; no standalone implementation |
| fleeingMonsterAwareOfPlayer | 2363 | — | MISSING | Flee-awareness check; not ported |
| getSafetyMap | 2371 | monsters/monster-actions.ts:866 (ctx iface) | MISSING | Context interface only; turn.ts:348 stubs with `allocGrid()` |
| monsterBlinkToSafety | 2394 | monsters/monster-actions.ts:216 (stub fn) | STUBBED-UNTRACKED | `monsterBlinkToSafetyStub` exported; no test.skip |
| generallyValidBoltTarget | 2534 | — | MISSING | Bolt target validity gating; no TS equivalent |
| targetEligibleForCombatBuff | 2563 | — | MISSING | Buff eligibility check; no TS equivalent |
| specificallyValidBoltTarget | 2587 | — | MISSING | Per-bolt-type target validation; no TS equivalent |
| monsterCastSpell | 2755 | — | MISSING | Core spell-casting dispatcher; no TS equivalent |
| monstUseBolt | 2777 | — | MISSING | Bolt selection/firing logic; covered partially by monstUseMagicStub |
| monstUseMagic | 2808 | monsters/monster-actions.ts:198 (stub fn) | STUBBED-TRACKED | `monstUseMagicStub`; turn.test.ts:176 |
| isLocalScentMaximum | 2817 | monsters/monster-actions.ts:475 | NEEDS-VERIFICATION | Function exists; no direct test |
| scentDirection | 2833 | monsters/monster-actions.ts:524 | NEEDS-VERIFICATION | Function exists; wiring stubbed (turn.test.ts:181) |
| allyFlees | 2988 | monsters/monster-actions.ts:666 (ctx iface) | MISSING | Context interface only; no standalone implementation |
| monsterMillAbout | 3019 | monsters/monster-actions.ts:601 | NEEDS-VERIFICATION | Function exists; wiring stubbed in turn.ts:358; no direct test |
| moveAlly | 3040 | monsters/monster-actions.ts:686 | NEEDS-VERIFICATION | Function exists; no direct test |
| updateMonsterCorpseAbsorption | 3250 | monsters/monster-actions.ts:223 (stub fn) | STUBBED-UNTRACKED | `updateMonsterCorpseAbsorptionStub`; no test.skip |
| getMonsterDominationText | 4207 | — | MISSING | Monster domination UI text; not ported |
| buildProperCommaString | 4245 | — | MISSING | Comma-list builder for monster description; not ported |
| getMonsterAbilitiesText | 4288 | — | MISSING | Monster abilities text builder; not ported |
| staffOrWandEffectOnMonsterDescription | 4373 | — | MISSING | Sidebar staff/wand description; not ported |
| summarizePack | 4447 | — | MISSING | Pack inventory summary; not ported |
| mutateMonster | 28 | monsters/monster-creation.ts:141 | IMPLEMENTED | Tested in monster-creation.test.ts:211 |
| generateMonster | 58 | monsters/monster-creation.ts:346 | IMPLEMENTED | Tested in monster-creation.test.ts:426 |
| initializeMonster | 102 | monsters/monster-creation.ts:191 | IMPLEMENTED | Tested in monster-creation.test.ts:278 |
| monsterRevealed | 166 | monsters/monster-queries.ts:57 | IMPLEMENTED | Tested in monster-queries.test.ts:75 |
| monsterHiddenBySubmersion | 179 | monsters/monster-queries.ts:83 | IMPLEMENTED | Tested in monster-queries.test.ts:114 |
| monsterIsHidden | 203 | monsters/monster-queries.ts:191 | IMPLEMENTED | Tested in monster-queries.test.ts:243 |
| canSeeMonster | 229 | monsters/monster-queries.ts:221 | IMPLEMENTED | Tested in monster-queries.test.ts:282 |
| canDirectlySeeMonster | 245 | monsters/monster-queries.ts:244 | NEEDS-VERIFICATION | No dedicated test block in monster-queries.test.ts |
| monsterName | 255 | monsters/monster-queries.ts:265 | IMPLEMENTED | Tested in monster-queries.test.ts:317 |
| monsterIsInClass | 284 | monsters/monster-queries.ts:292 | IMPLEMENTED | Tested in monster-queries.test.ts:362 |
| monsterWillAttackTarget | 327 | monsters/monster-queries.ts:359 | IMPLEMENTED | Tested in monster-queries.test.ts:417 |
| monstersAreTeammates | 363 | monsters/monster-queries.ts:113 | IMPLEMENTED | Tested in monster-queries.test.ts:151 |
| monstersAreEnemies | 374 | monsters/monster-queries.ts:142 | IMPLEMENTED | Tested in monster-queries.test.ts:191 |
| initializeGender | 402 | monsters/monster-creation.ts:120 | IMPLEMENTED | Tested in monster-creation.test.ts:169 |
| setPlayerDisplayChar | 409 | game/game-init.ts:385 | NEEDS-VERIFICATION | No test; function is in game module not monsters/ |
| stringsMatch | 418 | — | MISSING | TS uses `===`; not needed as a function |
| resolvePronounEscapes | 435 | combat.ts:135 (ctx stub `(text)=>text`) | STUBBED-TRACKED | combat.test.ts:250 |
| pickHordeType | 502 | monsters/monster-spawning.ts:114 | IMPLEMENTED | Tested in monster-spawning.test.ts:112 |
| empowerMonster | 538 | monsters/monster-state.ts:228 | IMPLEMENTED | Tested in monster-state.test.ts:217 |
| cloneMonster | 559 | — | MISSING | Used in combat-runics (ctx method) but no standalone fn |
| forbiddenFlagsForMonster | 641 | monsters/monster-spawning.ts:43 | IMPLEMENTED | Tested in monster-spawning.test.ts:42 |
| avoidedFlagsForMonster | 663 | monsters/monster-spawning.ts:75 | IMPLEMENTED | Tested in monster-spawning.test.ts:82 |
| monsterCanSubmergeNow | 683 | monsters/monster-spawning.ts:250 | IMPLEMENTED | Tested in monster-spawning.test.ts:200 |
| spawnHorde | 782 | monsters/monster-spawning.ts:383 | IMPLEMENTED | Tested in monsters.test.ts:78 |
| fadeInMonster | 904 | items.ts:206, combat.ts:92, turn.ts:90 (stubs) | STUBBED-UNTRACKED | `() => {}` in three wiring files; no test.skip |
| createCreatureList | 911 | — | OUT-OF-SCOPE | TS uses plain JS arrays |
| iterateCreatures | 916 | — | OUT-OF-SCOPE | TS uses array iteration |
| hasNextCreature | 926 | — | OUT-OF-SCOPE | TS uses array iteration |
| nextCreature | 929 | — | OUT-OF-SCOPE | TS uses array iteration |
| prependCreature | 941 | monsters/monster-actions.ts:37 | IMPLEMENTED | Tested in monster-actions.test.ts:112 |
| removeCreature | 947 | monsters/monster-actions.ts:47 | IMPLEMENTED | Tested in monster-actions.test.ts:136 |
| firstCreature | 960 | — | OUT-OF-SCOPE | TS uses array access |
| freeCreatureList | 966 | — | OUT-OF-SCOPE | GC handles memory; not needed |
| populateMonsters | 1071 | monsters/monster-spawning.ts:530 | NEEDS-VERIFICATION | No direct test |
| getRandomMonsterSpawnLocation | 1086 | monsters/monster-spawning.ts:568 (callback param) | NEEDS-VERIFICATION | Passed as callback parameter, not a standalone export |
| spawnPeriodicHorde | 1115 | monsters/monster-spawning.ts:566 | NEEDS-VERIFICATION | No direct test |
| disentangle | 1138 | — | MISSING | Removes web/entanglement status; no TS equivalent |
| teleport | 1146 | items.ts:200 (ctx stub) | STUBBED-TRACKED | items.test.ts:214 |
| chooseNewWanderDestination | 1221 | monsters/monster-state.ts:255 | IMPLEMENTED | Tested in monster-state.test.ts:246 |
| burnedTerrainFlagsAtLoc | 1275 | monsters.ts:214 (ctx stub) | STUBBED-TRACKED | monsters.test.ts:274 |
| discoveredTerrainFlagsAtLoc | 1291 | state/helpers.ts:139 | NEEDS-VERIFICATION | Implemented; wiring sometimes stubbed (monsters.ts:215, lifecycle.ts:135) |
| monsterAvoids | 1304 | monsters/monster-state.ts:340 | IMPLEMENTED | Tested in monster-state.test.ts:340 |
| distanceBetween | 1578 | monsters/monster-state.ts:159 | IMPLEMENTED | Tested in monster-state.test.ts:124 |
| alertMonster | 1582 | monsters/monster-state.ts:173 | IMPLEMENTED | Tested in monster-state.test.ts:147 |
| wakeUp | 1587 | monsters/monster-state.ts:190 | IMPLEMENTED | Tested in monster-state.test.ts:170 |
| updateMonsterState | 1709 | monsters/monster-state.ts:594 | IMPLEMENTED | Tested in monster-state.test.ts:414 |
| decrementMonsterStatus | 1825 | monsters/monster-state.ts:727 | IMPLEMENTED | Tested in monster-state.test.ts:521 |
| traversiblePathBetween | 1994 | monsters/monster-actions.ts:333 | NEEDS-VERIFICATION | Function exists; wiring context stubs it; no direct test |
| specifiedPathBetween | 2014 | — | MISSING | Path existence check (straight-line); no TS equivalent |
| openPathBetween | 2035 | monsters.ts:220 (ctx stub) | STUBBED-TRACKED | monsters.test.ts:286 |
| monsterAtLoc | 2043 | items.ts:74, monsters.ts:50 (buildMonsterAtLoc) | NEEDS-VERIFICATION | Different API pattern (builder fn); not a direct port |
| dormantMonsterAtLoc | 2062 | movement/map-queries.ts:69 (ctx iface) | MISSING | Context interface only; no standalone implementation |
| perimeterCoords | 2260 | — | MISSING | Perimeter cell enumeration; not ported |
| monsterBlinkToPreferenceMap | 2290 | monsters/monster-actions.ts:205 (stub fn) | STUBBED-UNTRACKED | `monsterBlinkToPreferenceMapStub`; no test.skip |
| monsterSummons | 2409 | monsters/monster-actions.ts:140 | IMPLEMENTED | Tested in monster-actions.test.ts:272 |
| canNegateCreatureStatusEffects | 2463 | monsters/monster-actions.ts:65 | IMPLEMENTED | Tested in monster-actions.test.ts:161 |
| negateCreatureStatusEffects | 2481 | monsters/monster-actions.ts:90 | IMPLEMENTED | Tested in monster-actions.test.ts:202 |
| monsterIsNegatable | 2502 | — | MISSING | Determines if monster can be negated; no TS equivalent |
| resurrectAlly | 2889 | — | MISSING | Ally resurrection mechanic; not ported |
| unAlly | 2939 | combat.ts:256 (ctx stub `()=>{}`) | STUBBED-TRACKED | combat.test.ts:278 |
| monsterFleesFrom | 2947 | monsters/monster-state.ts:289 | IMPLEMENTED | Tested in monster-state.test.ts:290 |
| monstersTurn | 3319 | monsters/monster-actions.ts:907 | IMPLEMENTED | Tested in monster-actions.test.ts:349 |
| canPass | 3627 | monsters/monster-movement.ts:110 | IMPLEMENTED | Tested in monster-movement.test.ts:94 |
| isPassableOrSecretDoor | 3663 | monsters/monster-movement.ts:165 | IMPLEMENTED | Tested in monster-movement.test.ts:188 |
| knownToPlayerAsPassableOrSecretDoor | 3668 | movement/travel-explore.ts:103 | NEEDS-VERIFICATION | Implemented in movement module; no test in monsters context |
| setMonsterLocation | 3675 | monsters/monster-movement.ts:188 | IMPLEMENTED | Tested in monster-movement.test.ts:227 |
| moveMonster | 3711 | monsters/monster-movement.ts:484 | NEEDS-VERIFICATION | Function exists; wiring stubbed (turn.test.ts:171); no direct test |
| initializeStatus | 3895 | monsters/monster-creation.ts:81 | IMPLEMENTED | Tested in monster-creation.test.ts:122 |
| findAlternativeHomeFor | 3918 | monsters/monster-movement.ts:242 | IMPLEMENTED | Tested in monster-movement.test.ts:310 |
| getQualifyingLocNear | 3951 | monsters/monster-movement.ts:294 | IMPLEMENTED | Tested in monster-movement.test.ts:348 |
| getQualifyingGridLocNear | 4013 | monsters/monster-movement.ts:373 | IMPLEMENTED | Tested in monster-movement.test.ts:410 |
| makeMonsterDropItem | 4065 | monsters.ts:231 (inline impl) | NEEDS-VERIFICATION | Simplified inline (drops carriedItem); may not match full C logic |
| checkForContinuedLeadership | 4077 | combat.ts:131 (ctx stub) | STUBBED-TRACKED | combat.test.ts:239 |
| demoteMonsterFromLeadership | 4094 | combat.ts:130 (ctx stub) | STUBBED-TRACKED | combat.test.ts:234 |
| toggleMonsterDormancy | 4147 | monsters/monster-ops.ts:113 | IMPLEMENTED | Tested in monster-ops.test.ts:181 |
| monsterDetails | 4490 | — | MISSING | Sidebar monster description text; no TS equivalent |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 43 |
| STUBBED-TRACKED | 11 |
| STUBBED-UNTRACKED | 7 |
| MISSING | 27 |
| NEEDS-VERIFICATION | 20 |
| OUT-OF-SCOPE | 6 |
| DATA-ONLY | 0 |
| **Total** | **114** |

## Critical Gaps

List only MISSING and STUBBED-UNTRACKED items here, ordered by gameplay impact:

1. `monsterCastSpell` — monsters never cast spells; entire spell-casting pipeline absent
2. `monstUseBolt` — bolt selection/firing logic absent (monstUseMagicStub covers combined behavior but as a no-op)
3. `getSafetyMap` — monster flee-path computation missing; allied flee-movement broken
4. `allyFlees` — ally flee decision-making absent; allies will not retreat correctly
5. `creatureEligibleForSwarming` / `monsterSwarmDirection` — swarm attack coordination absent
6. `fadeInMonster` — monster appearance animation missing; monsters just appear without fade-in (3 wiring stubs, no test.skip)
7. `cloneMonster` — combat runic "spawning" effects use a ctx stub that never actually clones (MISSING, not stubbed)
8. `monsterDetails` — sidebar monster description is completely absent; `ctx.monsterDetails()` in sidebar-monsters.ts has no real implementation
9. `monsterBlinkToPreferenceMap` / `monsterBlinkToSafety` — monster blinking AI absent; stubs untracked
10. `updateMonsterCorpseAbsorption` — corpse-absorption mechanic disabled; stub untracked
11. `disentangle` — removing web/entanglement has no TS equivalent; affected monsters stay entangled
12. `resurrectAlly` — ally resurrection (spectral blade, etc.) missing; no TS equivalent
13. `monsterIsNegatable` — negation eligibility check absent; negation wand may mis-target
14. `drawManacles` — manacle terrain decoration skipped; visuals only, gameplay unaffected
15. `generallyValidBoltTarget` / `targetEligibleForCombatBuff` / `specificallyValidBoltTarget` — full bolt-target validation absent; depends on monsterCastSpell
16. `summonMinions` — summoning sub-routine absent; `monsterSummons` calls ctx stub
17. `specifiedPathBetween` / `dormantMonsterAtLoc` — path and dormant-monster queries missing
18. `perimeterCoords` — perimeter enumeration not ported; likely used by summoning/blinking
19. `monsterHasBoltEffect` / `monsterCanShootWebs` — bolt availability checks stubbed untracked
20. `fleeingMonsterAwareOfPlayer` — flee-aware check missing; affects flee AI quality
21. `getMonsterAbilitiesText` / `getMonsterDominationText` / `buildProperCommaString` / `staffOrWandEffectOnMonsterDescription` / `summarizePack` — full monster description sidebar absent

## Notes for follow-on initiative

**Spell/bolt casting pipeline is entirely absent**: `monsterCastSpell`, `monstUseBolt`,
`generallyValidBoltTarget`, `targetEligibleForCombatBuff`, `specificallyValidBoltTarget`,
`monsterHasBoltEffect`, `monsterCanShootWebs` all need to be ported together as a unit.
The `monstUseMagicStub` is a placeholder but covers the whole AI magic path; the real port
should split it into the same two C functions (monstUseBolt + monstUseMagic).

**Safety/flee AI is blocked**: `getSafetyMap` returns `allocGrid()` (empty), which means
allied flee-movement is broken. This requires porting the safety-map computation from
`Time.c` (or `Monsters.c` depending on where it lives in C) before monster flee/ally-flee
AI can work.

**Sidebar monster description is fully absent**: `monsterDetails`, `getMonsterAbilitiesText`,
`getMonsterDominationText`, `buildProperCommaString`, and `staffOrWandEffectOnMonsterDescription`
are all MISSING. The sidebar display system in `io/sidebar-monsters.ts` calls `ctx.monsterDetails()`
but no implementation exists. Priority for display completeness.

**Wiring stubs that need test.skip added** (rule violations): `fadeInMonster`, `drawManacles`,
`monsterCanShootWebs`, `monsterHasBoltEffect`, `monsterBlinkToPreferenceMap`, `monsterBlinkToSafety`,
`updateMonsterCorpseAbsorption` — seven STUBBED-UNTRACKED items.

**Low-risk missing items**: `stringsMatch` (TS uses `===`), creature-list functions
(OUT-OF-SCOPE), `drawManacle`/`drawManacles` (terrain decorations only — aesthetics but
not game logic). `awarenessDistance` was folded into `awareOfTarget` in TS.
