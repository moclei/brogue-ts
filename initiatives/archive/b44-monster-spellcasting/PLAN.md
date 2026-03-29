# B44 — Monster Spell-Casting System — Plan

## Approach

All domain logic is complete and tested in standalone files. The work is entirely in
the wiring layer. Four phases:

1. **Async interface surgery** — update `BoltAIContext.zap` and `MonsterBlinkContext.zap`
   to return `Promise<boolean>`, make all callers `async`.
2. **Split + wire ZapContext** — split `turn-monster-ai.ts`, build a real `ZapContext`
   for the monster AI path, replace `zap: () => {}` stubs.
3. **Async cascade through turn loop** — ensure `moveAlly`/`monstersTurn` callers
   properly `await` the async chain.
4. **Test coverage** — add/update integration tests.

## Technical Notes

### Why the stubs exist

`zap` in `items/zap.ts` is `async` (it drives bolt-travel animation via `pauseAnimation`).
The monster AI contexts in `turn-monster-ai.ts` typed `zap` synchronously, so the real
function could never be wired. The no-ops:

```ts
// turn-monster-ai.ts lines 440, 485
zap: () => {}
```

### Async cascade map

```
monsterCastSpell   (monster-bolt-ai.ts)   calls ctx.zap → must be async
  └─ monstUseBolt                         calls monsterCastSpell → must be async
       └─ monstUseMagic                   calls monstUseBolt → must be async

monsterBlinkToPreferenceMap (monster-blink-ai.ts) calls ctx.zap → must be async
  └─ monsterBlinkToSafety                 calls monsterBlinkToPreferenceMap → must be async

moveAlly           (monster-actions.ts)   awaits monstUseMagic, monsterBlink* → async
  └─ monstersTurn                         awaits moveAlly → async

turn-monster-ai.ts wiring closures        must be async lambdas
lifecycle.ts / turn.ts caller             must await monstersTurn per monster
```

### Phase 2: ZapContext construction

`ZapContext` (`items/zap-context.ts`) has ~30 dependencies. The pattern already exists
in `items/staff-wiring.ts` (lines 321–512). Extract a shared factory or duplicate the
relevant construction into a new file `turn-monster-zap-wiring.ts`.

Most ZapContext dependencies are already available in `buildMonstersTurnContext()`:
`pmap`, `player`, `monsters`, `rogue`, all catalogs, `attackCtx`, `combatMessage`, etc.
Effect stubs (`haste`, `slow`, `negate`, etc.) can mirror `staff-wiring.ts`'s approach.

### Phase 1 file list

| File | Change |
|------|--------|
| `monsters/monster-bolt-ai.ts` | `monsterCastSpell`, `monstUseBolt`, `monstUseMagic` → `async`; `BoltAIContext.zap` returns `Promise<boolean>` |
| `monsters/monster-blink-ai.ts` | `monsterBlinkToPreferenceMap`, `monsterBlinkToSafety` → `async`; `MonsterBlinkContext.zap` returns `Promise<boolean>` |
| `monsters/monster-actions.ts` | Update context interfaces (`MoveAllyContext`, enemy contexts) to accept async functions; `moveAlly` and `monstersTurn` → `async`; await all calls |
| `tests/monsters/monster-bolt-ai.test.ts` | Add `async` to affected tests |
| `tests/monsters/monster-blink-ai.test.ts` | Add `async` to affected tests |

### Phase 2 file list

| File | Change |
|------|--------|
| `turn-monster-zap-wiring.ts` _(new)_ | `buildMonsterZapFn()` factory → returns the wired `async zap(...)` for monster contexts |
| `turn-monster-ai.ts` | Import `buildMonsterZapFn`; replace `zap: () => {}` in `boltAICtx` and `blinkCtx`; split file to stay under 600 lines |

### turn-monster-ai.ts split strategy

At 685 lines (limit: 600), the file must be split as part of Phase 2.
Natural extraction target: the ZapContext wiring block into `turn-monster-zap-wiring.ts`.
Secondary candidate: wander/path contexts into `turn-monster-path-wiring.ts` if still needed.

### Dead code to remove

`monstUseMagicStub`, `monsterBlinkToPreferenceMapStub`, `monsterBlinkToSafetyStub` in
`monsters/monster-actions.ts` are exported but unused. Remove them in Phase 1.

## Open Questions

- (resolved) Does B44 depend on B45? No — `zap` is already implemented. Some
  `detonateBolt` effects may be stubs but the dispatch chain fires.
- (resolved) Do `monstUseDomination`/`monstUseBeckon`/`monstUseBlinkAway` need porting?
  No — these do not exist in the C source.
