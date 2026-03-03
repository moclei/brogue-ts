# Phase 5: Gameplay Wiring — Plan

## Approach

The ~160+ remaining stubs in `runtime.ts` were organized into 9 phases across two tracks, ordered by gameplay impact. Each phase targeted a functional area and left the game in a more playable state than before.

### Track A: Wire Gameplay Systems (6 phases)

```
Phase 1: Messages         → Player gets text feedback for everything
Phase 2: Item Interaction  → Pick up, equip, use, drop, throw items
Phase 3: Monster Lifecycle → Monsters die, drop loot, terrain reacts
Phase 4: Combat Effects    → Weapon/armor runics, special hits, feats
Phase 5: UI Panels         → Sidebar, inventory screen, flavor text
Phase 6: Polish            → Search, encumbrance, flares, recording hooks, misc helpers
```

### Track B: Complete Gameplay Wiring (3 phases)

After Track A, ~16 actionable stubs remained plus ~7 functions that needed porting from C:

```
Phase 7: Core Playability    → Stairs work, monsters respect terrain, food works, mouse hover
Phase 8: Combat & Monsters   → Weapon specials, cloning, stealing, teleportation, force weapons
Phase 9: World Simulation    → Periodic spawning, safety maps, clairvoyance, floor item decay
```

Each phase followed the same pattern:
1. Identify all stubs in the target area
2. Check that the real functions are ported and exported
3. Build or extend the relevant DI context in `runtime.ts`
4. Replace stubs with real calls
5. Verify compilation + tests + manual play

## Technical Notes

### Shared Message Helper Pattern

Many DI contexts need `message`, `messageWithColor`, `confirmMessages`. A `buildMessageOps()` helper returns an object with all message methods that can be spread into each context.

### MonsterStateContext Pattern

`monsterAvoids` is wired in 8 places via a shared `buildMonsterStateContext()` helper.

### moveCursor Porting

`moveCursor` from Items.c:5372 was ported as an async function that `await`s browser events, replacing the C synchronous blocking I/O pattern.

### Incremental Testability

Each phase was manually testable:
- After Phase 1: Player sees combat text
- After Phase 2: Items can be picked up, equipped, dropped
- After Phase 3: Monsters die, drop loot, terrain reacts
- After Phase 6: Manual search, miner's light, flares all work
- After Phase 7: Stairs work, monsters avoid hazards, mouse hover shows paths
- After Phase 9: Reinforcements spawn, clairvoyance ring works, floor items decay
