# Port V2 — Verify Mechanics

## Intent

Consolidate all remaining outstanding mechanics work before moving to playtesting.
This initiative pulls unchecked items from `port-v2-fix-rendering` and `port-v2-platform`,
resolves a known potential bug (`charmRechargeDelay`), implements the remaining targeting UI
domain functions, and verifies the high-risk NEEDS-VERIFICATION functions from the audit.

The game should be mechanically complete and internally consistent after this initiative.
Playtesting against a running browser is deferred to `port-v2-playtest`.

## Goals

- Targeting UI fully implemented: player can aim bolts, cycle targets, blink
- `charmRechargeDelay` verified against C (flagged as potentially buggy)
- All 20 NEEDS-VERIFICATION Monsters.c functions reviewed, divergences fixed or tracked
- All 20 NEEDS-VERIFICATION RogueMain.c functions reviewed, tests added
- All 18 NEEDS-VERIFICATION Architect.c functions reviewed, tests added
- All stubs have paired `test.skip` entries; stale `test.skip` entries removed

## Scope

What's in:
- 7 targeting UI domain functions deferred from `port-v2-platform` Phase 8
- `charmRechargeDelay` bug verification (flagged in `port-v2-fix-rendering` Phase 5a notes)
- NEEDS-VERIFICATION review for Monsters.c, RogueMain.c, Architect.c (58 functions total)
- Stubs audit: confirm all stubs have test.skip; remove stale ones

What's out:
- Browser smoke test — deferred to `port-v2-playtest` initiative
- Lower-risk NEEDS-VERIFICATION files (MainMenu.c 20, Buttons.c 8, Wizard.c 10, Light.c 5,
  Items.c 5, IO.c 4, Movement.c 3, Time.c 2, Combat.c 2) — deferred; address if bugs are
  found during playtesting
- Save/load, recordings — persistence layer initiative
- SeedCatalog.c — CLI tool, out of scope

## Prerequisites

- `port-v2-domain-gaps` complete ✓ (all 72 MISSING core domain functions implemented)
- `port-v2-platform` Phases 1–6 complete ✓ (browser platform, IO, menus, entry point)
- `port-v2-fix-rendering` Phases 1–5a complete ✓ (getCellAppearance, refreshDungeonCell,
  displayLevel, saveRecording stub, item system, monster AI, PowerTables.c verified)

## Source references

- Outstanding items from `port-v2-fix-rendering`: Phase 1c browser smoke test (deferred),
  Phase 5b/5c NEEDS-VERIFICATION review
- Outstanding items from `port-v2-platform`: Phase 7 playtest tasks (deferred),
  Phase 8 targeting UI
- Audit reference: `docs/audit/gaps-Monsters.md`, `docs/audit/gaps-RogueMain.md`,
  `docs/audit/gaps-Architect.md`, `docs/audit/summary.md`
