# Audit: Wizard.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured 9 of 11 functions — both missed functions are public
(non-static): `dialogSelectEntryFromList` (C:39) and `dialogCreateItemOrMonster` (C:508).
Supplemented with the public-function grep pass. TASKS.md estimated ~10 functions; actual count
is 11.

Wizard.c is the debug/wizard-mode dialog module. It contains the full pipeline for creating
arbitrary items and monsters during a wizard-mode game. The module is split into two TS files:
- `menus/wizard.ts` — 6 functions: `initializeCreateItemButton`, `dialogSelectEntryFromList`,
  `dialogCreateMonsterChooseMutation`, `dialogCreateMonster`, `dialogCreateItemOrMonster`, plus
  helper `unflag` (from RogueMain.c — already audited)
- `menus/wizard-items.ts` — 5 functions: `dialogCreateItemChooseVorpalEnemy`,
  `dialogCreateItemChooseRunic`, `dialogCreateItemChooseKind`,
  `dialogCreateItemChooseEnchantmentLevel`, `dialogCreateItem`

`creatureTypeCompareMonsterNames` (C:265) is a `qsort` comparator function. In the TS port it
is absorbed inline as `.sort((a, b) => a.monsterName.localeCompare(b.monsterName))` in
`dialogCreateMonster`. There is no TS equivalent function — this is OUT-OF-SCOPE (C-specific
construct replaced by native JS sort).

**Coverage is complete** — all gameplay-logic C functions have real TS implementations with no
stubs or missing logic. All implementations are classified NEEDS-VERIFICATION because no wizard
function has a direct unit test and no `test.skip` tracking entry exists.

**Notable wiring observation:** `dialogCreateItemOrMonster` is wired at `io/input-dispatch.ts:390`
via the context interface in `io/input-keystrokes.ts:180`, which declares it as `(): void`.
The actual function is `async (): Promise<void>`. The call site does NOT await the returned
promise (`ctx.dialogCreateItemOrMonster()` with no `await`). In practice this is likely
harmless — the dialog is modal and runs its own event loop — but the type mismatch warrants
human review before treating the wiring as complete.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| initializeCreateItemButton | 27 | menus/wizard.ts:221 | NEEDS-VERIFICATION | Real impl; uppercases text and sets button; no direct test |
| dialogSelectEntryFromList | 39 | menus/wizard.ts:240 | NEEDS-VERIFICATION | Real impl; full button-loop dialog; public fn missed by inventory script; no direct test |
| dialogCreateItemChooseVorpalEnemy | 91 | menus/wizard-items.ts:39 | NEEDS-VERIFICATION | Real impl; builds enemy-list buttons from monsterCatalog; no direct test |
| dialogCreateItemChooseRunic | 106 | menus/wizard-items.ts:59 | NEEDS-VERIFICATION | Real impl; branches on weapon/armor runic lists, calls vorpalEnemy if needed; no direct test |
| dialogCreateItemChooseKind | 176 | menus/wizard-items.ts:144 | NEEDS-VERIFICATION | Real impl; returns item kind index from category dialog; no direct test |
| dialogCreateItemChooseEnchantmentLevel | 198 | menus/wizard-items.ts:172 | NEEDS-VERIFICATION | Real impl; text-entry prompt for enchantment level; no direct test |
| creatureTypeCompareMonsterNames | 265 | — | OUT-OF-SCOPE | qsort comparator; replaced inline by `.sort((a,b) => a.monsterName.localeCompare(b.monsterName))` in dialogCreateMonster |
| dialogCreateMonsterChooseMutation | 280 | menus/wizard.ts:294 | NEEDS-VERIFICATION | Real impl; filters by forbidden flags, presents mutation list; no direct test |
| dialogCreateMonster | 305 | menus/wizard.ts:330 | NEEDS-VERIFICATION | Real impl; multi-page monster picker, placement, ally prompt; no direct test |
| dialogCreateItem | 439 | menus/wizard-items.ts:250 | NEEDS-VERIFICATION | Real impl; full item creation pipeline; no direct test |
| dialogCreateItemOrMonster | 508 | menus/wizard.ts:454 | NEEDS-VERIFICATION | Real impl; wired at io/input-dispatch.ts:390 but ctx type declares (): void vs async (): Promise<void> — unawaited call; no direct test |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 0 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 10 |
| OUT-OF-SCOPE | 1 |
| DATA-ONLY | 0 |
| **Total** | **11** |

## Critical Gaps

No MISSING or STUBBED-UNTRACKED functions. Wizard.c is fully ported.

The most significant concern is not a porting gap but a wiring type mismatch:

1. `dialogCreateItemOrMonster` wired at `io/input-dispatch.ts:390` without `await` — the
   context interface at `io/input-keystrokes.ts:180` declares it as `(): void` while the
   implementation is `async (): Promise<void>`. If the dialog's internal event loop depends
   on being awaited (e.g. to block subsequent keystrokes), this could cause double-input bugs
   in wizard mode. Human review needed before wizard mode is considered functional.

## Notes for follow-on initiative

**Wizard.c has zero porting gaps** — all gameplay logic is ported across wizard.ts and
wizard-items.ts. The entire NEEDS-VERIFICATION backlog is a testing gap, not a porting gap.

**Wizard mode is a debug feature** — lower priority than core gameplay gaps. Tests for wizard
functions should wait until the rendering layer (getCellAppearance, refreshDungeonCell,
displayLevel) is implemented, because wizard dialogs that place monsters and items depend on
refreshDungeonCell to show the result.

**Wiring type mismatch to fix before wizard mode is exercised:**
- `io/input-keystrokes.ts:180`: change `dialogCreateItemOrMonster(): void` to
  `dialogCreateItemOrMonster(): Promise<void>` and add `await` at `io/input-dispatch.ts:390`.

**Priority order for direct tests (follow-on test pass):**
1. `initializeCreateItemButton` — pure factory; trivial to test; verify text is uppercased
2. `dialogCreateItemChooseVorpalEnemy` — verify button list length matches catalog count
3. `dialogCreateItemChooseKind` — verify button count matches itemKindCount for a category
4. `dialogSelectEntryFromList` — integration test; provide mock buttonInputLoop returning 0
5. `dialogCreateItem`, `dialogCreateMonster` — end-to-end; require full WizardContext mock
