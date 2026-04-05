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

To be determined in Phase 2. Entry point is the title screen menu in the TS port.
The tool modifies blueprint `frequency` and `depthRange[0]` values in-memory before
game generation begins.

## Rejected Approaches

- Force-spawn specific blueprints: bypasses `blueprintQualifies`, could produce
  configurations impossible in C game, leading to false bug reports.

## Open Questions

- Where exactly in the TS codebase is the title screen menu rendered? (Phase 2, task 1)
- Is `keyOnTileAt` the correct hook for key-pickup machine triggers, or is it
  `updateEnvironment` / something else? (Phase 1 / Phase 3)
- Are dormant monster flags (`MONST_DORMANT` or equivalent) implemented in TS, and if
  so, are they wired to the activation path? (Phase 3)
- How many distinct blueprint types are there? Does the list fit cleanly in a checklist
  UI, or will it need grouping? (Phase 2, task 1)
