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
- **PARTIALLY RESOLVED**: Are dormant monster flags implemented in TS and wired to
  activation? The `MF_MONSTERS_DORMANT` placement path is fully implemented in TS
  (`buildAMachine` calls `ctx.monsterOps.toggleMonsterDormancy` after spawning).
  However, `DFF_ACTIVATE_DORMANT_MONSTER` in `spawnDungeonFeature` is entirely absent
  from TS — dormant monsters are placed correctly but never awakened at runtime.
  This is a confirmed high-severity gap. See machines.md § Known TS Gaps.
- How many distinct blueprint types are there? Does the list fit cleanly in a checklist
  UI, or will it need grouping? (Phase 2, task 1)

## Gap List

> Stub — to be expanded in Phase 3. Sourced from Phase 1 Task 6 TS verification.
> Full details in `.context/research/machines.md` § Known TS Gaps.

### Systemic (affect all or many machine types)

- **`evacuateCreatures` MISSING** in `spawnDungeonFeature` — blocking terrain can spawn into occupied cells during both generation and runtime
- **`DFF_ACTIVATE_DORMANT_MONSTER` MISSING** in `spawnDungeonFeature` — dormant monsters are placed correctly but never wake at runtime; all dormant-monster machines (turrets, rats, vampires, zombies, statues, etc.) are non-functional at runtime
- **`staleLoopMap` not set** in `fillSpawnMap` — loop-map not invalidated after terrain changes

### Runtime-only (refresh=true path; no generation-time impact)

- `applyInstantTileEffectsToCreature` absent from `fillSpawnMap`
- `burnItem` absent from `fillSpawnMap`
- `flavorMessage` absent from `fillSpawnMap`
- `aggravateMonsters` / `DFF_AGGRAVATES_MONSTERS` absent from `spawnDungeonFeature`
- `colorFlash` / `createFlare` absent from `spawnDungeonFeature`
- `message` (feature description) absent from `spawnDungeonFeature`

### Per-machine-type

- **`DFF_RESURRECT_ALLY` MISSING** in `spawnDungeonFeature` — legendary ally shrine non-functional
- Bullet Brogue variant check absent from `addMachines` — out of scope for current target

