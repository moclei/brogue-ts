# Audit: Globals.c / GlobalsBase.c / Utilities.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** Three files consolidated into one gap file per TASKS.md.

**Globals.c** (1821 lines) is overwhelmingly DATA-ONLY: lines 1–579 are the
tileCatalog, liquidCatalog, gasCatalog, surfaceCatalog, dungeonFeatureCatalog,
dungeonProfileCatalog, monsterBehaviorCatalog and all other global constant arrays.
Only 2 functions exist, appended at the end of the file (lines 581–597): `terrainFlags`
and `terrainMechFlags`. Both are IMPLEMENTED in `rogue-ts/src/state/helpers.ts`.
Note: `io/input-context.ts:247–248` has untracked wiring stubs (`() => 0`) for both —
these should receive `test.skip` entries in Phase 3.

**GlobalsBase.c** (123 lines) is 100% DATA-ONLY: it declares and initialises the global
`rogue`, `rng`, and related game-state structs. No functions are present. The equivalent
TS state is managed via `getGameState()` / `createGameState()` in `rogue-ts/src/state/`.

**Utilities.c** (37 lines) contains 2 C-specific string-manipulation helpers (`endswith`,
`append`) that exist only because C lacks built-in string operations. Both are
OUT-OF-SCOPE: JavaScript provides native equivalents (`.endsWith()`, string
concatenation) and no TS ports are needed.

## Function Coverage

| C Function | File | C Line | TS Location | Category | Notes |
|---|---|---|---|---|---|
| terrainFlags | Globals.c | 581 | state/helpers.ts:36 | IMPLEMENTED | C annotation present; tested in movement/map-queries.test.ts. Untracked wiring stub at io/input-context.ts:247 (`() => 0`) — needs test.skip in Phase 3 |
| terrainMechFlags | Globals.c | 590 | state/helpers.ts:51 | IMPLEMENTED | C annotation present; tested in movement/map-queries.test.ts. Untracked wiring stub at io/input-context.ts:248 (`() => 0`) — needs test.skip in Phase 3 |
| endswith | Utilities.c | 26 | — | OUT-OF-SCOPE | C-specific string helper; superseded by native JS `.endsWith()` |
| append | Utilities.c | 33 | — | OUT-OF-SCOPE | C fixed-buffer append; superseded by native JS string concatenation |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 2 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 0 |
| OUT-OF-SCOPE | 2 |
| DATA-ONLY | 0 |
| **Total** | **4** |

## Critical Gaps

None. All game-logic functions from these three files are IMPLEMENTED.

## Notes for follow-on initiative

**No fix work required** for Globals.c, GlobalsBase.c, or Utilities.c.

The two untracked wiring stubs for `terrainFlags` / `terrainMechFlags` in
`io/input-context.ts:247–248` should be addressed in Phase 3 synthesis — add
`test.skip` entries in the relevant test file (likely `movement/map-queries.test.ts`
or a new `io/input-context.test.ts`) documenting that the cursor-context wiring
needs real tile-map access rather than a constant-zero stub.

The bulk of the catalog data in Globals.c (tileCatalog, featureCatalog, etc.) has
equivalent TS representations scattered across `rogue-ts/src/catalogs/` and
`rogue-ts/src/state/`. No systematic gap was found, but the audit did not cross-check
individual catalog entries — that level of data validation is out of scope for this
initiative.
