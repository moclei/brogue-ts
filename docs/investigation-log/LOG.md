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

---

## B79 — No bolt animation when zapping a staff
Symptom: all combat effects work but no visual bolt trail appears

- Located the stub — Read: staff-wiring.ts:118 → buildZapRenderContext() returns all no-ops; hiliteCell, plotCharWithColor, pauseAnimation all stubbed
- Confirmed real factories exist — Read: io-wiring.ts:127,134 → buildRefreshDungeonCellFn, buildHiliteCellFn already exported; buildGetCellAppearanceFn at line 112
- Confirmed plotCharWithColor/mapToWindow exports — Grep: "export.*plotCharWithColor|export.*mapToWindow" in io/display.ts → both exported
- Confirmed pauseAndCheckForEvent export — Grep: "pauseAndCheckForEvent" in platform.ts → exported at line 128
- Checked hiliteCell call site — Grep: "hiliteCell" in zap.ts → line 374: hiliteCell(cx, cy, boltColor, strength, false)
- Checked getCellAppearance return type — buildGetCellAppearanceFn returns {glyph,...} but ZapRenderContext expects {char,...} → needs rename in wrapper

Root cause: buildZapRenderContext() in staff-wiring.ts:118 returns no-op stubs for hiliteCell, plotCharWithColor, pauseAnimation, and getCellAppearance; replace with real implementations from buildHiliteCellFn/buildGetCellAppearanceFn/plotCharWithColorFn/pauseAndCheckForEvent
Steps logged: 6

---

## B82 — Vault items always same type regardless of seed
Symptom: wands and charms found in vaults are always the same kind (e.g., always teleportation wand, always health charm) regardless of game seed

- Frequencies non-zero in catalog — Read: item-catalog.ts:263-292 → wandTable and charmTable have nonzero frequencies (3,3,3,3,1,3,2,3,1 and 5,5,5,3,...)
- chooseKind logic matches C — Read: item-generation.ts:222-233 → TS impl identical to C Items.c:409-418
- numKinds suspect — Grep: "numberWandKinds|numberCharmKinds" in src/ → game-constants.ts:60,65 both = 0
- Init function missing assignments — Read: lifecycle.ts:259-267 → initializeGameVariantBrogue sets scroll/potion/bolt counts but omits numberWandKinds and numberCharmKinds
- Confirmed same gap in RapidBrogue and BulletBrogue variants — Read: lifecycle.ts:268-287

Root cause: lifecycle.ts:259 — initializeGameVariantBrogue() (and rapid/bullet variants) never set gameConst.numberWandKinds or numberCharmKinds; both stay 0; chooseKind loops 0 times (totalFrequencies=0), randRange(1,0) returns 1, loop exits at i=0 every time
Steps logged: 5

---

## B86 — Auto-explore ('x') stops working after first depth
Symptom: pressing 'x' explores depth 1 fully, then every subsequent press immediately shows "I see no path for further exploration." even when unexplored areas exist

- Suspect no-path check is evaluated from the wrong position — Read: explore-wiring.ts:39-49 → confirms: explore() called first, then nextStep checked from frontier position
- Checked C reference for correct order — Read: IO.c:2313-2363 → C computes explore map and follows path to target BEFORE calling explore(); calls explore() only if target found
- Verified nextStep returns NO_DIRECTION at frontier — Read: travel-explore.ts:186-200 → knownToPlayerAsPassableOrSecretDoor blocks stepping into undiscovered cells; at frontier all distances equal
- Confirmed pmap not the issue — Read: core.ts:270 + architect/architect.ts:129 → pmap mutated in-place; clearLevel zeroes flags; not a stale reference
- Confirmed player.loc not stale — Read: movement.ts:441+ → player.loc mutated in-place during moves; captured reference stays valid
- Confirmed updateVision fires on each move — Read: turn.ts:276 + game-level.ts:411 → updateVision called in playerTurnEnded inside playerMoves; DISCOVERED flags set correctly

- Traced C knownToPlayerAsPassableOrSecretDoor — Read: Monsters.c:3668 → calls getLocationFlags(limitToPlayerKnowledge=true); for undiscovered cells uses ACTUAL terrain flags (floor→passable, wall→not)
- Compared TS implementation — Read: movement.ts:525 → returns false for ALL undiscovered cells; this is the bug: TS nextStep can never step into undiscovered floor tiles
- Confirmed Dijkstra item-goal issue — Read: travel-explore.ts:543-549 → item at player's cell makes player's dist a local minimum (exploreGoalValue-10); since pickUpItemAt is stubbed, player stands on items
- Read getLocationFlags C logic — Read: Movement.c:1751-1777 → DISCOVERED+MAGIC_MAPPED+!visible→remembered flags; else→actual flags

Root cause (revised): movement.ts:525 — knownToPlayerAsPassableOrSecretDoor returns false for ALL undiscovered cells; C uses actual terrain flags (passable floors allowed). Secondary: travel-explore.ts:543 — item at player's cell creates Dijkstra local minimum (since pickUpItemAt is stubbed). Fix: (1) match C's getLocationFlags behavior for undiscovered cells; (2) skip item-goal for player's current cell.
Steps logged: 10

---

## B52 — Teleport scroll: player symbol missing until next move
Symptom: after using a scroll of teleport, the `@` glyph does not appear at the new location until the player takes another action

- Backlog says likely cause is missing refreshDungeonCell for new location — Read: items.ts:384 → inline setMonsterLocation calls refreshDungeonCell(monst.loc) for old loc but never for new loc
- Confirmed C setMonsterLocation calls both — Read: Monsters.c:3675 → refreshDungeonCell(monst->loc) line 3678 (old), refreshDungeonCell(newLoc) line 3691 (new)

Root cause: items.ts inline setMonsterLocation (teleport context) missing refreshDungeonCell(loc) for the new location
Steps logged: 2

---

## B62 — Pit bloat fall: no message or keypress before showing lower level
Symptom: when a pit bloat explodes beneath the player, the game jumps immediately to the lower level with no message or keypress prompt

- Located playerFalls in C to understand expected behavior — Read: Time.c:977-1028 → calls message(flavorText, REQUIRE_ACKNOWLEDGMENT) BEFORE startLevel()
- Located TS playerFalls implementation — Read: creature-effects.ts:702-761 → calls ctx.message() without await; function is sync (void return)
- Checked call sites in turn-processing.ts — Read: turn-processing.ts:440-445, 807-811 → ctx.playerFalls() called without await at both locations
- Checked wiring in turn.ts — Read: turn.ts:534-605 → playerFalls closure calls playerFallsFn() synchronously, message not awaited
- Confirmed interface declares wrong return type — Read: creature-effects.ts:128 → message declared as void (not void | Promise<void>); turn-processing.ts:197 → playerFalls declared as void

Root cause: playerFalls is sync but calls async message() without await; the REQUIRE_ACKNOWLEDGMENT message fires and is ignored; startLevel runs immediately
Steps logged: 5

---

## B67 — Potion of paralysis: status appears instant (no tick-down)
Symptom: after drinking a paralysis potion, the paralysis status bar appears and vanishes without counting down

- Checked C decrementPlayerStatus and drinkPotion for paralysis case — Read: Time.c:1969-2020, Items.c:7315 → gas cloud spawned; decrementPlayerStatus decrements STATUS_PARALYZED by 1 per 100-tick environment update
- Verified TS port of decrementPlayerStatus and applyInstantTileEffectsToCreature — Read: creature-effects.ts:584-631 and 1163-1183 → both correct; paralysis gas sets status to max(current, 20)
- Confirmed gas tile spawning path — Read: machines.ts:980-1008 → gas layer: sets pmap[x][y].volume and layers[Gas]; tile catalog entry has T_CAUSES_PARALYSIS flag
- Checked how cellHasTerrainFlag reads gas layer — Read: helpers.ts:36-43 → correctly OR-combines all layers including Gas
- Found the stub — Read: turn.ts:405 → pauseAnimation: () => false — stub returns immediately without commitDraws() or yielding to browser
- Confirmed callers need await — Read: turn-processing.ts:652,786 → both call sites are in async playerTurnEnded but didn't await; sidebar refreshes during paralysis loop never flushed to canvas

Root cause: TurnProcessingContext.pauseAnimation stubbed as () => false in turn.ts; during the paralysis do-while loop, refreshSideBar was called ~20 times but commitDraws() was never called, so the browser rendered only the final state (paralysis gone) when JS yielded
Steps logged: 6
