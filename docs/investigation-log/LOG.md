# Investigation Log

Append new entries below. Do not edit past entries.

---

## B64 — Staff of obstruction does nothing
Symptom: zapping a staff of obstruction has no visible effect

- Need C source for BOLT_OBSTRUCTION effect handler — Grep: "BOLT_OBSTRUCTION" in Items.c → no hits; searching across all brogue/ → only Rogue.h enum + Globals.c staff table entry
- Found bolt effect dispatch in Items.c — Read: Items.c:4732 → BE_OBSTRUCTION calls spawnDungeonFeature(x, y, DF_FORCEFIELD, true, false) with magnitude-scaled probabilityDecrement
- Checked TS detonateBolt — Read: bolt-detonation.ts:57 → code calls ctx.spawnDungeonFeature correctly, but has comment noting magnitude scaling deferred
- Found the stub — Read: staff-wiring.ts:470 → spawnDungeonFeature: () => {} — zap context stub, nothing actually spawns

Root cause: staff-wiring.ts:470 — ZapContext.spawnDungeonFeature is a no-op stub; detonateBolt calls it correctly but the stub discards the call
Steps logged: 4

---

## B65 — Creatures can occupy the same square as the player
Symptom: monsters move onto the player's tile without triggering combat or being blocked

- Backlog suspects missing HAS_PLAYER check in monster movement or monsterAvoids — Read: monster-movement.ts → moveMonster and monsterAvoids logic look correct
- Checking where setMonsterLocation is called without guard — Grep: "setMonsterLocation" in src/ → 8 call sites; combat-attack.ts:247 suspicious
- Found the bug — Read: combat-attack.ts:245 → `!(ctx.cellFlags(...) & 0x3)` but HAS_PLAYER=Fl(2)=4 and HAS_MONSTER=Fl(3)=8, so correct mask is 0xC not 0x3; check always passes
- Same error at line 186 — buildHitList sweep check also uses `& 0x3` instead of `& (HAS_PLAYER|HAS_MONSTER)`

Root cause: combat-attack.ts processStaggerHit:245 — bitmask `0x3` should be `TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER` (0xC); the broken check always passes, allowing knockback onto occupied tiles including player's square
Steps logged: 4

---

## B77 — Player health regenerates faster than C game
Symptom: HP recovers noticeably faster than in Brogue v1.15.1

- Suspecting turnsBetweenRegen not set correctly — Read: items/item-effects.ts:524 → updatePlayerRegenerationDelay looks structurally correct
- Checking when updatePlayerRegenerationDelay is called in C — Grep: "updatePlayerRegenerationDelay" in src/brogue/ → Items.c:7272,7896 and inside updateRingBonuses (7896)
- Tracing C updateRingBonuses call chain — Read: RogueMain.c:672 → startLevel calls updateRingBonuses() which calls updatePlayerRegenerationDelay()
- Tracing TS startLevel — Read: game/game-level.ts:411-413 → calls ctx.updateRingBonuses() and ctx.updateMinersLightRadius() but NOT updatePlayerRegenerationDelay
- Confirming the bug — Read: lifecycle.ts:529 → updateRingBonuses wires to updateRingBonusesFn only; no updatePlayerRegenerationDelay call anywhere in LevelContext
- Without updatePlayerRegenerationDelay, turnsBetweenRegen stays at 20 (catalog value in thousandths), causing regen every turn instead of every ~7 turns

Root cause: startLevel never calls updatePlayerRegenerationDelay; player.info.turnsBetweenRegen stays at catalog value 20 (thousandths) instead of 7550, so regen fires every turn
Steps logged: 6
