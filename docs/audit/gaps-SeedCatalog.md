# Audit: SeedCatalog.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** TASKS.md prediction "Likely DATA-ONLY or OUT-OF-SCOPE" was correct — the file
is entirely OUT-OF-SCOPE. SeedCatalog.c is a standalone CLI seed-scanning tool: it iterates a
range of seeds, generates each dungeon level, and writes a CSV catalog of items/monsters/altars
to stdout via `printf`. No gameplay logic, no state mutation, no UI. The browser port has no
stdout, no file output, and no audience for this feature (speedrunners use the native binary).
All 10 functions are OUT-OF-SCOPE. Zero TS equivalents found anywhere in `rogue-ts/src/`.

SeedCatalog.c is a developer/speedrunner utility: `printSeedCatalog` (the single public entry
point) is called from RogueMain.c when invoked with `--seed-catalog` CLI flags. It runs entirely
outside the game loop. The browser entry point (`bootstrap.ts`) has no CLI argument handling,
so this feature cannot be reached even if ported.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| printSeedCatalogCsvLine | 36 | — | OUT-OF-SCOPE | Static helper; formats and writes one CSV row via printf |
| getMonsterDetailedName | 45 | — | OUT-OF-SCOPE | Static helper; builds a display name string for a monster |
| printSeedCatalogItem | 53 | — | OUT-OF-SCOPE | Static; prints one item entry to stdout |
| printSeedCatalogMonster | 115 | — | OUT-OF-SCOPE | Static; prints one monster entry to stdout |
| printSeedCatalogMonsters | 144 | — | OUT-OF-SCOPE | Static; iterates all monsters and prints each |
| printSeedCatalogMonsterItems | 160 | — | OUT-OF-SCOPE | Static; prints items carried by monsters |
| printSeedCatalogFloorGold | 176 | — | OUT-OF-SCOPE | Static; prints floor gold piles to stdout |
| printSeedCatalogFloorItems | 197 | — | OUT-OF-SCOPE | Static; prints floor items to stdout |
| printSeedCatalogAltars | 217 | — | OUT-OF-SCOPE | Static; prints altar info to stdout |
| printSeedCatalog | 254 | — | OUT-OF-SCOPE | Public entry point; CLI-only, called via --seed-catalog flag |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 0 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 0 |
| OUT-OF-SCOPE | 10 |
| DATA-ONLY | 0 |
| **Total** | **10** |

## Critical Gaps

None. SeedCatalog.c has zero gameplay-relevant gaps.

## Notes for follow-on initiative

**SeedCatalog.c requires no fix work.** The seed catalog feature is a native-binary-only CLI
utility. It is not part of the gameplay loop and cannot be meaningfully ported to a browser
context without a complete output mechanism (file download, modal display, etc.).

**If a future initiative wants to expose seed catalog data in-browser**, the recommended approach
is to port `printSeedCatalog`'s iteration logic into a new `seed-catalog.ts` module that returns
a structured array instead of printing, and wire it into a dedicated UI panel. This is out of
scope for port-v2 and should be tracked as a separate feature initiative.
