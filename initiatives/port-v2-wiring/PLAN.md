# Port V2 — Wiring — Plan

## Approach

Write each domain file in order of dependency. `core.ts` first (it has no domain dependencies). Then each domain that depends on it, building outward. For each file: write the integration test first, then write the context builder until the test passes.

### Build order

```
core.ts          ← no domain dependencies (just types + module files)
  └─ turn.ts     ← depends on core.ts state
  └─ combat.ts   ← depends on core.ts state
       └─ monsters.ts  ← depends on combat.ts (for damage), core.ts
       └─ items.ts     ← depends on combat.ts (for bolt damage), core.ts
  └─ movement.ts ← depends on core.ts, combat.ts (for weapon attacks)
  └─ ui.ts       ← depends on core.ts (stubs for actual IO — wired in port-v2-platform)
```

### The async bridge rule

Any context builder function that wraps a C call that blocks (waiting for input, playing an animation) must be `async`. Specifically:
- `nextBrogueEvent` / event-waiting: always `async`, always `await platform.waitForEvent()`
- `pauseAnimation`: `async`, returns immediately in non-display contexts (game logic doesn't block)
- Never use a synchronous queue-peek as a substitute for async waiting in a context that could block

This rule is enforced in context builders. If a module function calls something that should be async and it isn't, add `async` to the chain rather than hacking around it.

### Stub policy

If a function in a module has known unimplemented behavior (from the first attempt or from C source review):
1. Wire the real function (don't write a new stub in the context builder)
2. If the real function itself has a stub, add `test.skip('stub: <description>', () => { /* what correct behavior should look like */ })`
3. The count of `test.skip` in the test suite = the count of known incomplete behaviors

Functions in `monsters/monster-actions.ts` and `architect/architect.ts` have stubs from the first attempt. Enumerate these as `test.skip` items during this initiative.

## Technical Notes

### core.ts structure

```typescript
// Shared mutable game state — closed over by all domain context builders
let player: Creature;
let rogue: RogueState;
let pmap: Pcell[][];
let tmap: Tcell[][];
let monsters: Creature[];
let dormantMonsters: Creature[];
let packItems: Item[];
let floorItems: Item[];
// ... other state fields

// Game lifecycle
export function initGameState(): void { ... }
export function gameOver(message: string, useAnimation: boolean): void { ... }

// Context builder utilities shared across domain files
export function getGameState() { return { player, rogue, pmap, ... }; }
```

Domain files import from `core.ts` and close over the shared state. They do NOT re-export state — they only export context builder functions.

### Per-domain file structure

Each file follows this pattern:
```typescript
// combat.ts
import { getGameState } from './core.js';
import { inflictDamage, killCreature } from './combat/combat-damage.js';
// ... other imports

export function buildCombatDamageContext(): CombatDamageContext {
    const { player, rogue, pmap, monsters } = getGameState();
    return {
        player,
        rogue,
        pmap,
        inflictDamage: (attacker, defender, damage, color, knockback) =>
            inflictDamageFn(attacker, defender, damage, color, knockback, buildCombatDamageContext()),
        killCreature: (creature, quiet) =>
            killCreatureFn(creature, quiet, buildCombatDamageContext()),
        // ... rest of context
    };
}
```

### Integration tests

Each integration test sets up a minimal valid game state in `core.ts`, runs a real function through its context, and asserts the resulting state. Tests do not mock the context builders — they use the real ones. This is what makes them integration tests.

Example (turn cycle with dying monster):
```typescript
test('dying monster is excluded from turn scheduler', () => {
    initGameState();
    const monster = spawnTestMonster({ movementSpeed: 100 });
    monster.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;

    const ctx = buildTurnProcessingContext();
    ctx.player.ticksUntilTurn = 100;
    playerTurnEndedFn(ctx);

    // Should not warn about soonestTurn, should complete in O(1) iterations
    expect(ctx.player.ticksUntilTurn).toBeLessThanOrEqual(0);
});
```

## Open Questions
- Should `ui.ts` context builders return no-op stubs for display functions, or should they import and wire the IO functions at this stage? Leaning toward: wire what exists in `io/`, stub what doesn't. Revisit when port-v2-platform starts.
- How to handle the `recordings/` subsystem — defer entirely to port-v2-platform or set up the interface now?
