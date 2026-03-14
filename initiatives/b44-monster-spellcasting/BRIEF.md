# B44 — Monster Spell-Casting System

## Intent
Wire the fully-implemented monster spell-casting pipeline into the live game loop.
All domain logic already exists; the only gap is an async cascade through the wiring
layer that currently stubs `zap` as a no-op.

## Goals
- Monsters fire bolts (damage, slow, haste, negation, discord, beckoning, etc.) at
  valid targets during their turn.
- Monsters with blink abilities (`BE_BLINKING`) teleport via `monsterBlinkToPreferenceMap`.
- `monsterBlinkToSafety` triggers correctly for fleeing enemies/allies.
- `summonMinions` continues to work (already wired; no regression).
- No test regressions.

## Scope

What's in:
- Making `BoltAIContext.zap` and `MonsterBlinkContext.zap` accept the real `async zap()`
- Building a `ZapContext` in the monster AI wiring path (`turn-monster-ai.ts`)
- Async cascade through `monsterCastSpell`, `monstUseBolt`, `monstUseMagic`,
  `monsterBlinkToPreferenceMap`, `monsterBlinkToSafety`, `moveAlly`, `monstersTurn`
- Splitting `turn-monster-ai.ts` (currently 685 lines — already over the 600-line cap)

What's out:
- Porting any domain function — they are all already implemented
- `monstUseDomination`, `monstUseBeckon`, `monstUseBlinkAway` — these functions do not
  exist in the C source; all spells route through `monstUseBolt` → `monsterCastSpell` → `zap`
- Individual bolt *effect* completeness (B45 territory) — the dispatch chain fires even
  if some `detonateBolt` effects are stubs
- `HORDE_SUMMONED_AT_DISTANCE` path in `summonMinions` (needs `calculateDistances`,
  deferred separately)

## Constraints
- 600-line cap per file — `turn-monster-ai.ts` must be split before ZapContext wiring
- `zap` is `async`; the cascade must not use fire-and-forget (no unhandled promises)
- No behavior change in Phase 1 (async interface changes only)
- B44 does not depend on B45
