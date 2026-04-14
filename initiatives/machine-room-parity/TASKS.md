# Machine Room Parity — Tasks

## Phase 1: Research

- [x] Create `docs/research/machines.md` from template; add entry to INDEX.md
- [x] Use CodeQL to map the full C call chain from `addMachines` and `buildAMachine`;
      document in research doc
- [x] Document blueprint data structures, flags (`BP_*`), and the blueprint catalog
      (count types, note depth ranges and frequencies for major types)
- [x] Document the machine trigger/activation path in C: how key pickup leads to machine
      effects (trace `keyOnTileAt`, `updateEnvironment`, dungeon feature activation)
- [x] Document dormant monster mechanics in C: how monsters enter/exit dormant state,
      what activates them, relevant flags
- [x] Verify `gaps-Architect.md` NEEDS-VERIFICATION and MISSING claims against current
      TS code for the 6 key machine functions: `buildAMachine`, `addMachines`,
      `runAutogenerators`, `redesignInterior`, `fillSpawnMap`, `spawnDungeonFeature`
- [x] Finalize research doc: integration points, invariants, known TS gaps confirmed

# --- handoff point ---

## Phase 2: Tooling

- [x] Locate title screen menu in TS codebase; identify where to add the debug menu
      entry point
- [x] Enumerate all blueprint types from the C blueprint catalog; establish readable
      names for the checklist
- [x] Design and implement the debug menu: checklist of all machine types, accessible
      from title screen
- [x] Wire selected types: boost `frequency` significantly and set `depthRange[0]` to 1
      for all checked blueprints before game generation
- [x] Smoke-test: verify that selected types appear on shallow floors and that
      unselected types are not suppressed

# --- handoff point ---

## Phase 3: Gap Analysis

- [x] Compare `buildAMachine` C vs TS: document any logic divergence
- [x] Compare `addMachines` and `runAutogenerators` C vs TS
- [x] Compare `redesignInterior` and `prepareInteriorWithMachineFlags` C vs TS
- [x] Trace the key-pickup → machine-trigger path in TS; compare to C; document gaps
- [x] Trace dormant monster activation in TS; compare to C; document gaps
- [x] Examine B128 fix (`462ba1a`): determine if turret tile placement is a regression
      and document what the correct behavior should be
- [x] Consolidate all findings into a gap list in PLAN.md under a new
      `## Gap List` section; prioritize systemic gaps above per-machine gaps

# --- handoff point ---

## Phase 4: Fixes

*Revised after Phase 3 gap analysis and rat trap playtesting (2026-04-07).*

### Systemic fixes

- [x] Fix dormant activation missing from `turn-env-wiring.ts` `spawnDungeonFeature` closure:
      add the same `onFeatureApplied` dormant-activation callback used in `tile-effects-wiring.ts`
      (line 178) and `movement.ts` (line 248). Wire `dormantMonsters` from `getGameState()`.
      Root cause of rat trap "no rats" bug — `DF_WALL_SHATTER` (`DFF_ACTIVATE_DORMANT_MONSTER`)
      is called via `promoteTile → ctx.spawnDungeonFeature` in the `updateEnvironment` path,
      which currently has no handler for that flag.
- [x] Fix `activateMachine → monstersTurn` no-op in `updateEnvironment` path
      (`turn-env-wiring.ts:149`): wire `monstersTurn` using the same pattern as
      `tile-effects-wiring.ts`. Affects machines where trigger comes via `updateEnvironment`
      (e.g. key-missing reversal `TM_PROMOTES_WITHOUT_KEY`).
- [x] Implement `evacuateCreatures` in `spawnDungeonFeature`: before applying blocking terrain,
      displace any creature occupying a target cell. C ref: `Architect.c evacuateCreatures`.
- [x] Fix `staleLoopMap` not set in `fillSpawnMap`: after writing a pathfinding-blocking tile,
      set `ctx.rogue.staleLoopMap = true`. C ref: `Architect.c fillSpawnMap`.
- [x] Fix `keyOnTileAt` duplication: consolidate the 4 closures to a shared helper and fix
      `item-helper-context.ts` variant which uses `ItemCategory.KEY` instead of
      `ItemFlag.ITEM_IS_KEY` and omits the monster-carried item check.

### Per-machine fixes

- [x] Implement `DFF_RESURRECT_ALLY` in `spawnDungeonFeature`: find the player's most recently
      killed ally and restore it at the feature location. Required for legendary ally shrine.
      C ref: `Architect.c spawnDungeonFeature DFF_RESURRECT_ALLY block`.
- [x] Verify and fix glyph + guardian room: stepping on a glyph tile should teleport the player;
      trace `DF_GUARDIAN_STEP` / `DF_INACTIVE_GLYPH` / `DF_ACTIVE_GLYPH` feature chain in TS vs C.
      NO GAP — full chain verified faithful: tile flags, DF catalog entries, monster catalog, and
      activateMachine→monstersTurn wiring all match C. Guardian takes one step (not teleport) when
      glyph fires; "teleport" in task description was a mischaracterization of C behavior.
- [x] Verify arrow turret room after systemic fixes: turrets should remain dormant until lever
      trigger, then activate and take an immediate turn. Depends on dormant activation and
      `monstersTurn` fixes above.
      NO GAP — full chain verified faithful: TURRET_DORMANT tile (TM_IS_WIRED + DF_TURRET_EMERGE),
      TURRET_LEVER tile (TM_PROMOTES_ON_PLAYER_ENTRY + DF_TURRET_LEVER), DF_TURRET_EMERGE catalog
      entry (DFF_ACTIVATE_DORMANT_MONSTER), DF_TURRET_LEVER catalog entry
      (DFF_ACTIVATE_DORMANT_MONSTER), MONST_TURRET flag set, toggleMonsterDormancy (ticksUntilTurn=200),
      and dormant-activation wiring in turn-env-wiring.ts all match C. Turrets do NOT get an immediate
      turn via MONST_GETS_TURN_ON_ACTIVATION (that flag is guardians/totems only); they wake with
      ticksUntilTurn=200 and fire on their next regular turn — C-faithful.
- [x] Verify dormant statue vault after systemic fixes: monster should appear when statue
      shatters. Depends on dormant activation fix above.
      NO GAP — full chain verified faithful: STATUE_DORMANT tile (TM_IS_WIRED + DF_CRACKING_STATUE),
      STATUE_CRACKING tile (promoteChance=3500 + DF_STATUE_SHATTER), STATUE_INSTACRACK tile
      (TM_IS_WIRED + DF_STATUE_SHATTER direct), DF_CRACKING_STATUE (entry 187) and
      DF_STATUE_SHATTER (entry 188, DFF_ACTIVATE_DORMANT_MONSTER, no DFF_EVACUATE_CREATURES_FIRST
      — correct, C does not set it for statues), onFeatureApplied dormant-activation wired in
      turn-env-wiring.ts (lines 140-156), toggleMonsterDormancy called with dormancyCtx.
      Activation path: activateMachine → promoteTile(STATUE_DORMANT) → DF_CRACKING_STATUE →
      tile becomes STATUE_CRACKING → subsequent turns random promote → DF_STATUE_SHATTER →
      DFF_ACTIVATE_DORMANT_MONSTER → toggleMonsterDormancy. All C-faithful.

### Cosmetic / low-priority

- [x] Runtime-only gaps batch: `applyInstantTileEffectsToCreature`, `burnItem`, `flavorMessage`
      (fillSpawnMap); `aggravateMonsters`/`DFF_AGGRAVATES_MONSTERS`, `colorFlash`/`createFlare`,
      feature description `message` (spawnDungeonFeature). No generation-time impact.
- [x] Add `fadeInMonster` to `toggleMonsterDormancy` wakeup: wire into `DormancyContext`;
      cosmetic only.

# --- handoff point ---

## Phase 5: Verification

- [ ] Use debug tool to cycle through each machine type; record pass/fail per type
- [ ] Playtest sign-off: all major machine types behave as expected
- [ ] Update research doc with any findings from fix/verification work
- [ ] Regenerate port health snapshot (`cd tools/analysis && npx tsx scan-stubs.ts && npx tsx port-health.ts`)

## Deferred
