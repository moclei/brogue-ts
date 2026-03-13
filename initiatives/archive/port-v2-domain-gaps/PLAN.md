# PLAN: port-v2-domain-gaps

## Session Protocol

**One sub-phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked task.
2. Complete that task only. Do not continue into the next task.
3. Commit. Update TASKS.md (check off completed tasks).
4. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-domain-gaps. Read: .context/PROJECT.md, initiatives/port-v2-domain-gaps/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact task name from TASKS.md]
   Branch: feat/port-v2-domain-gaps
   ```
   Add a `## Session Notes [date]` to PLAN.md only if there are decisions worth preserving.

Stop at 60% context. Do not start a new task to fill remaining context.

---

## Approach

Work through missing functions in dependency order. For each function or group:

1. Read the C source implementation in `src/brogue/` (ground truth)
2. Implement the TS equivalent — new file or extension of an existing file (600-line limit)
3. Add unit tests
4. Wire into the relevant context builder
5. Remove any `test.skip` entries now unblocked

Where a function is large or has unclear dependencies, do a **read-through phase first**
(document inputs, branches, dependencies in Session Notes) before implementing.

The gap files in `docs/audit/gaps-*.md` are the reference for what is missing and where the
C line numbers are. The C source is ground truth for correctness.

---

## Known dependency relationships

- `teleport` requires `disentangle` (implement disentangle first)
- `summonMinions` requires `perimeterCoords` + `calculateDistances` (already IMPLEMENTED)
- `allyFlees` requires `getSafetyMap`
- `monsterBlinkToSafety` requires `getSafetyMap`
- `zap` requires `detonateBolt`, `boltEffectForItem`, `boltForItem`,
  `impermissibleKinkBetween`, `tunnelize`
- `spawnDungeonFeature` is IMPLEMENTED in `architect/machines.ts:979`; Phase 5 wires
  the `() => {}` stubs in turn.ts/movement.ts/items.ts; test.skip entries track the gaps

---

## Session Notes 2026-03-07 — Phase 1b read-through

### zap architecture decision: rendering via ZapRenderContext

`zap` (Items.c:4814) is 361 lines. Rendering is deeply interleaved with game logic inside
the main bolt-travel loop. The TS implementation must separate them:

- All rendering/animation calls go into a `ZapRenderContext` injected into `zap`
- Stubs in the context for: `refreshSideBar`, `displayCombatText`, `refreshDungeonCell`,
  `getCellAppearance`, `backUpLighting`, `restoreLighting`, `demoteVisibility`,
  `updateFieldOfViewDisplay`, `paintLight`, `updateVision`, `updateLighting`,
  `hiliteCell`, `pauseAnimation` (async — returns boolean fast-forward flag)
- Domain state flows through separately

### File split plan (Phases 1c + 1d)

```
items/bolt-helpers.ts       — impermissibleKinkBetween, tunnelize,
                              negationWillAffectMonster, projectileReflects
items/bolt-update.ts        — updateBolt (large switch; per-cell monster/tile effects)
items/bolt-detonation.ts    — detonateBolt (impact effects)
items/zap.ts                — zap (main engine; rendering via ZapRenderContext)
```

### Dependency map for Phase 1c helpers

- `impermissibleKinkBetween` — pure geometry; needs `cellHasTerrainFlag`
- `projectileReflects` — needs `netEnchant`, `reflectionChance`, `monsterIsInClass`,
  `monstersAreEnemies`, `rand_percent`
- `negationWillAffectMonster` — needs `boltCatalog`; pure logic
- `tunnelize` — needs `spawnDungeonFeature` (stub), `freeCaptivesEmbeddedAt`,
  `monsterAtLoc`, `inflictLethalDamage`, `killCreature`, `tileCatalog`, `pmap`

### updateBolt bolt-effect dependencies (Phase 1d)

All already-implemented functions: `attack`, `inflictDamage`, `killCreature`,
`moralAttack`, `splitMonster`, `haste`, `imbueInvisibility`, `wandDominate`,
`becomeAllyWith`, `negate` (Phase 2a but can stub), `empowerMonster`, `addPoison`,
`heal`, `cloneMonster` (Phase 4b), `flashMonster`, `wakeUp`, `exposeCreatureToFire`,
`exposeTileToFire`, `exposeTileToElectricity`.
Stubs needed: `teleport` (Phase 2c), `beckonMonster` (Phase 5), `slow` (Phase 2a),
`polymorph` (Phase 2b).

### detonateBolt dependencies (Phase 1d)

- `spawnDungeonFeature` — already IMPLEMENTED in `architect/machines.ts:979`; inject
  as a context dependency in DetonationContext/ZapContext (DI pattern). Phase 5 wires
  the real implementation into the remaining `() => {}` stubs in turn.ts/movement.ts/items.ts.
- `staffBladeCount` — need to verify if implemented
- `generateMonster`, `getQualifyingPathLocNear`, `fadeInMonster` — for BE_CONJURATION
- `disentangle` — MISSING (Phase 2c); needed for BE_BLINKING
- `setUpWaypoints` — for BE_TUNNELING; check if implemented
- `applyInstantTileEffectsToCreature`, `pickUpItemAt`, `checkForMissingKeys` — for BE_BLINKING player case

### reflectBolt note

The C version uses `perimeterCoords(rand_range(0, 39))` for random reflection targets.
The current TS `reflectBolt` in bolt-geometry.ts uses a simplified fallback. Phase 4a
implements `perimeterCoords` — wire it into `reflectBolt` at that point.
