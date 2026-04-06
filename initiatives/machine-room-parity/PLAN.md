# Machine Room Parity — Plan

## Approach

Five linear phases. Research before code. Tooling before fixes. Fixes before verification.

1. **Research** — build a verified research doc for the C machine pipeline using CodeQL
   call-chain analysis and targeted C source reads. Treat existing audit docs as hints,
   not facts.
2. **Tooling** — build a debug menu on the title screen with per-type blueprint selection.
   Selected types get a frequency boost and depth-range collapse to depth 1. Blueprint
   qualification logic runs unchanged.
3. **Gap Analysis** — systematic C vs TS comparison for the key machine functions. Produce
   a documented gap list. No fixes yet.
4. **Fixes** — address gaps starting with systemic issues (creature evacuation, trigger
   mechanics, dormant states) before per-machine-type behavior.
5. **Verification** — walk through each machine type using the debug tool. Playtest
   sign-off per type.

## Technical Notes

### Blueprint Data Structure (C)

Each blueprint (`blueprintCatalog` entry) has:
- `depthRange[2]` — min/max dungeon depth for eligibility
- `frequency` — tickets in a raffle; higher = more likely
- Various flags (`BP_*`) that control interior design, room type, monster behavior

Debug tool modifies these values in-memory before `addMachines` is called — no changes
to persistent game data or saved blueprints.

### Machine Generation Pipeline (C — to be verified in Phase 1)

Rough call chain (verify with CodeQL):
```
addMachines
  └─ blueprintQualifies (per-candidate-location, per-blueprint)
       └─ buildAMachine
            ├─ expandMachineInterior / fillInteriorForVestibuleMachine
            ├─ redesignInterior (if BP_REDESIGN_INTERIOR)
            ├─ prepareInteriorWithMachineFlags
            ├─ fillSpawnMap → spawnDungeonFeature
            │    └─ evacuateCreatures (MISSING in TS)
            └─ monster + item placement
```

### Known Gaps (from audit — to be verified)

- `evacuateCreatures` — MISSING in TS. Displaces creatures before terrain spawns. Impact:
  blocking terrain can spawn inside occupied cells during machine build.
- `keyOnTileAt` — critical stub. Key pickup triggering machine effects likely depends on
  this or a related mechanism in `updateEnvironment`.
- `promoteTile` — critical stub (7 occurrences). Tile state changes (dormant→active,
  wall shatters) depend on this.
- `spawnDungeonFeature` — implemented and tested, but `evacuateCreatures` is never called
  before it.
- B128 (merged, PR #124) — "defer arrow turrets until machine room reveal" fix. May have
  introduced turret placement on floor tiles as a regression. To be examined in Phase 3.

### Debug Tool Location

Title screen main menu — fifth button "Debug Menu" (hotkey D/d), `NGCommand.MachineDebug`.
Source files:
- `rogue-ts/src/menus/machine-debug.ts` — state (`boostedBlueprints`), catalog helper
  (`getDebugBlueprintCatalog`), and the dialog (`showMachineDebugMenu`).
- `rogue-ts/src/menus/main-menu.ts` — button wiring and `mainBrogueJunction` case.
- `rogue-ts/src/lifecycle-level.ts` — applies boosts via `activeBlueprintCatalog`
  before passing to `archCtx` and `machineContext`.
- `rogue-ts/src/types/enums.ts` — `NGCommand.MachineDebug` added.

UI: two-level dialog. Top level shows 5 blueprint groups with [sel/total] counts.
Selecting a group opens a per-blueprint toggle list ([ ] / [x] prefix, letter hotkeys).
"Clear all" resets state. All boosts are session-scoped in-memory only.

The tool modifies blueprint `frequency` and `depthRange[0]` values in-memory before
game generation begins.

## Rejected Approaches

- Force-spawn specific blueprints: bypasses `blueprintQualifies`, could produce
  configurations impossible in C game, leading to false bug reports.

## Open Questions

- Where exactly in the TS codebase is the title screen menu rendered? (Phase 2, task 1)
- **RESOLVED**: Is `keyOnTileAt` the correct hook for key-pickup machine triggers?
  Yes. `keyOnTileAt` is called by `applyInstantTileEffectsToCreature` in `Time.c` (line 452),
  which is the correct hook. It is also called by `updateEnvironment` (key-missing reversal)
  and `checkForMissingKeys` (anti-exploit). Full call chain documented in machines.md
  under "Machine Triggers".
- **RESOLVED**: Are dormant monster flags implemented in TS and wired to activation?
  Yes, fully. `MF_MONSTERS_DORMANT` placement is correct in `buildAMachine`.
  `DFF_ACTIVATE_DORMANT_MONSTER` is implemented via `onFeatureApplied` hook in
  `movement.ts` and `tile-effects-wiring.ts` — both closures correctly iterate
  `dormantMonsters` and call `toggleMonsterDormancy`. Confirmed in Phase 3.
- How many distinct blueprint types are there? Does the list fit cleanly in a checklist
  UI, or will it need grouping? (Phase 2, task 1)

## Gap List

> Phase 3 complete — 2026-04-05. Full line-by-line comparison of all 6 key functions plus trigger and dormant paths.

### Systemic (affect all or many machine types)

- **`evacuateCreatures` MISSING** in `spawnDungeonFeature` — blocking terrain can spawn into occupied cells during both generation and runtime
- **`staleLoopMap` not set** in `fillSpawnMap` — loop-map not invalidated after terrain changes
- **`keyOnTileAt` duplicated across 4 closures** — no single source of truth; divergence already present: `item-helper-context.ts` uses `ItemCategory.KEY` instead of `ItemFlag.ITEM_IS_KEY` and omits the monster-carried check. The primary trigger path (`tile-effects-wiring.ts`) is correct; the item-command path is wrong. Severity: Medium (maintainability + one incorrect variant).

### Trigger path

- **`activateMachine` → `monstersTurn` no-op in `updateEnvironment` path** — when `activateMachine` is triggered via `updateEnvironment → promoteTile → activateMachine`, the `monstersTurn` field is wired as a permanent-defer no-op in `turn-env-wiring.ts:149`. Monsters with `MONST_GETS_TURN_ON_ACTIVATION` do NOT receive their immediate activation turn from this code path. The creature-effects path (`tile-effects-wiring.ts`) is correct. Severity: Medium — affects machines where the trigger comes from `updateEnvironment` (e.g., key-missing reversal for `TM_PROMOTES_WITHOUT_KEY`).

### Runtime-only (refresh=true path; no generation-time impact)

- `applyInstantTileEffectsToCreature` absent from `fillSpawnMap`
- `burnItem` absent from `fillSpawnMap`
- `flavorMessage` absent from `fillSpawnMap`
- `aggravateMonsters` / `DFF_AGGRAVATES_MONSTERS` absent from `spawnDungeonFeature`
- `colorFlash` / `createFlare` absent from `spawnDungeonFeature`
- `message` (feature description) absent from `spawnDungeonFeature`
- **`fadeInMonster` not called during `toggleMonsterDormancy` wakeup** — C calls `fadeInMonster` (visual flash) when a dormant monster is awakened; TS `toggleMonsterDormancy` does not call it (`fadeInMonster` not in `DormancyContext`). Severity: Low / cosmetic — monster activates correctly in all game-logic respects.

### Per-machine-type

- **`DFF_RESURRECT_ALLY` MISSING** in `spawnDungeonFeature` — legendary ally shrine non-functional
- Bullet Brogue variant check absent from `addMachines` — out of scope for current target

### Resolved (Phase 3)

- **`DFF_ACTIVATE_DORMANT_MONSTER`** — previously listed as MISSING / high-severity. Confirmed implemented via `onFeatureApplied` hook in `movement.ts` and `tile-effects-wiring.ts`. Both closures correctly iterate `dormantMonsters` and call `toggleMonsterDormancy`. Gap is CLOSED.
- **`prepareInteriorWithMachineFlags`** — first-time verified in Phase 3. All 8 flag blocks present and in correct order. No gap.
- **`redesignInterior`** — verified match confirmed in Phase 3. No gap.
- **`addMachines` / `runAutogenerators`** — verified exact match in Phase 3 (except the known Bullet Brogue variant check, which is out of scope). No new gaps.
- **Outer failsafe clobbered by item-gen loop (C quirk)** — C's `buildAMachine` outer retry `failsafe` variable is reused as the inner item-generation loop counter and left at 0–999 after item gen. TS uses a separate `itemFailsafe` variable; the outer retry counter is unaffected. TS behaviour is strictly more correct. Not a gap.

### B128 regression check

B128 (PR #124) is not a regression — turret tile placement is unchanged. B128 correctly moved dormant monsters from the `monsters` list (with `MB_IS_DORMANT`) to the `dormantMonsters` list; turrets are still placed via `MF_BUILD_IN_WALLS` in wall tiles with terrain set to `TURRET_DORMANT`.

