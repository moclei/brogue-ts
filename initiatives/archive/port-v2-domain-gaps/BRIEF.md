# Port V2 — Domain Gaps

## Intent

Implement the MISSING core domain functions identified by the port-v2-audit. These are the
structural building blocks that must exist before the game is functionally complete. The
port-v2-audit gave us a full map of what is missing — this initiative works through that map
in dependency order, starting with the functions that block the most other code.

This initiative does not target verification or wiring of already-implemented functions. It
targets functions that do not exist yet in TypeScript.

## Goals

- Bolt/zap system works: player can fire staves and wands; `useStaffOrWand` calls a real bolt engine
- Items are correctly freed when consumed or destroyed (`deleteItem`)
- Monster flee AI has real safety maps (`getSafetyMap`, `allyFlees`)
- Major spell effects implemented: negate, weaken, slow, polymorph, teleport, aggravateMonsters
- Monster summoning pipeline complete (`summonMinions`, `perimeterCoords`, `disentangle`)
- Monster combat gaps filled: `cloneMonster`, `creatureEligibleForSwarming`, `resurrectAlly`

## Scope

What's in:
- All MISSING domain functions from gaps-Items.md that affect core gameplay
- All MISSING domain functions from gaps-Monsters.md that affect AI correctness
- `spawnDungeonFeature` (blocks vomit/useKeyAt wiring in movement.ts; C source location TBD)
- Wiring each newly implemented function into its context builder

What's out:
- Targeting UI: `hiliteTrajectory`, `moveCursor`, `nextTargetAfter`, `chooseTarget` — IO/UI
  layer; belongs to port-v2-platform
- NEEDS-VERIFICATION review — deferred to port-v2-fix-rendering Phase 5 (after this initiative)
- Browser rendering, canvas, menus — port-v2-platform
- Enchant-swap group (`swapItemToEnchantLevel` etc.) — self-contained, lower priority; deferred
- `throwItem` + `hitMonsterWithProjectileWeapon` — depends on bolt system; schedule after Phase 1d
- Save/load, recordings — persistence layer initiative

## Prerequisites

- port-v2-fix-rendering Phases 1–4 complete (rendering, crash fix, item effects, monster AI
  bolt pipeline) ✓
