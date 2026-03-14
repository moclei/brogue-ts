# B44 — Monster Spell-Casting System — Tasks

## Phase 1: Async interface surgery

- [x] Update `BoltAIContext.zap` in `monsters/monster-bolt-ai.ts` to return `Promise<boolean>`
- [x] Make `monsterCastSpell`, `monstUseBolt`, `monstUseMagic` async in `monster-bolt-ai.ts`
- [x] Update `MonsterBlinkContext.zap` in `monsters/monster-blink-ai.ts` to return `Promise<boolean>`
- [x] Make `monsterBlinkToPreferenceMap`, `monsterBlinkToSafety` async in `monster-blink-ai.ts`
- [x] Update `MoveAllyContext` and enemy-move context interfaces in `monster-actions.ts` to accept async `monstUseMagic`, `monsterBlinkToPreferenceMap`, `monsterBlinkToSafety`
- [x] Make `moveAlly` and `monstersTurn` async in `monster-actions.ts`; await all spell/blink calls
- [x] Remove dead stubs: `monstUseMagicStub`, `monsterBlinkToPreferenceMapStub`, `monsterBlinkToSafetyStub` from `monster-actions.ts`
- [x] Update `turn-monster-ai.ts` wiring closures to be async lambdas (still `zap: async () => false` stub for now)
- [x] Add `async` to affected tests in `monster-bolt-ai.test.ts` and `monster-blink-ai.test.ts`
- [x] Run `npx vitest run` — no regressions
- [x] Commit: `feat: B44 phase 1 — async interface cascade for monster spell/blink pipeline`

## Phase 2: Split turn-monster-ai.ts + wire real zap

- [x] Create `turn-monster-zap-wiring.ts` — export `buildMonsterZapFn()` factory that builds a wired `async zap(...)` using the game state (mirror `staff-wiring.ts` pattern)
- [x] Split `turn-monster-ai.ts` to bring it under 600 lines (extract ZapContext wiring block into `turn-monster-zap-wiring.ts`) — also extracted summonMinionsCtx/summonsCtx/blinkCtx/blinkToSafetyCtx/boltAICtx/corpseAbsorptionCtx via `buildMonsterBoltBlinkContexts()`
- [x] Import and wire `buildMonsterZapFn` into `boltAICtx.zap` and `blinkCtx.zap` (now inside `turn-monster-zap-wiring.ts`)
- [x] Run `npx vitest run` — no regressions (88 files, 2286 pass, 55 skip)
- [ ] Smoke-test in browser: confirm monsters fire bolts (e.g. goblin conjurer casts)
- [ ] Commit: `feat: B44 phase 2 — wire real zap into monster bolt/blink contexts`

## Phase 3: Async cascade through turn loop

- [x] Find where `monstersTurn` is called per-monster in `lifecycle.ts` / `turn.ts`; ensure each call is properly `await`-ed
- [x] Verify no fire-and-forget Promises remain in the monster turn path
- [x] Run `npx vitest run` — no regressions (88 files, 2286 pass, 55 skip)
- [ ] Commit: `feat: B44 phase 3 — await monster turns through async cascade`

## Phase 4: Test coverage

- [ ] Add/update test in `monster-bolt-ai.test.ts`: `monstUseBolt` fires `zap` when a valid target exists (mock `zap`)
- [ ] Add/update test: `monsterBlinkToPreferenceMap` fires `zap` for a blink-capable monster
- [ ] Add/update test: `monsterCastSpell` logs combat message and calls `zap`
- [ ] Add/update test: `monstUseMagic` routes summon-first, then bolt
- [ ] Run `npx vitest run` — no regressions
- [ ] Check off B44 in `docs/BACKLOG.md`
- [ ] Commit: `feat: B44 — monster spell-casting system wired end-to-end`
