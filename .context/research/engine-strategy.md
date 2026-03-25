# Engine Strategy: Build On vs. Rewrite vs. Adopt

> Last verified: 2026-03-24

## Summary

Analysis of whether to continue building on the BrogueCE TypeScript port as a
foundation for an original game, versus writing a new engine from scratch or
adopting an existing engine (primarily Godot). Conclusion: stay in TypeScript,
invest in the rendering layer via libraries (Pixi.js or similar), and build
game logic features on the existing codebase.

## Context

The TypeScript port of BrogueCE is substantially complete (~49K lines of C
ported, ~2300 passing tests, browser-playable). The question is whether this
codebase is a viable foundation for an original game that may include features
well beyond Brogue's scope.

## Features Under Consideration

Not all must-haves; potential directions ranked by how well they fit the
current codebase versus requiring a different platform.

| Feature | Category | Codebase fit | Notes |
|---------|----------|-------------|-------|
| Networking (multiplayer/co-op) | Game logic | Strong | Turn-based grid games are easy to network. WebSockets are native to TS/browser. |
| Real-time movement (grid-based) | Game logic + presentation | Moderate | Game loop refactor needed (tick-based instead of input-blocking). `requestAnimationFrame` is native. Design challenge > implementation challenge. |
| Isometric rendering | Presentation | Moderate | Rendering transform only — game logic stays 2D grid. Coordinate transforms, y-sorting, asset pipeline. Pixi.js has community examples. Godot has this built in. |
| Animations & particle effects | Presentation | Moderate | Pixi.js handles sprites, particles, blend modes, filters. No visual timeline editor (code-first). |
| Terrain destruction/building (DF-like) | Game logic | Strong | Brogue already has a terrain transformation system (fire, water, gas, pressure plates, machines). Extending for player-initiated placement is natural. |
| Deeper simulation | Game logic | Strong | Brogue simulates fire spread, gas diffusion, light, creature ecology. More simulation = more game code; platform irrelevant. |

## Options Evaluated

### Option A: Stay on BrogueCE TypeScript codebase

**Strengths:**
- Working game with deep, tested systems (dungeon gen, combat, AI, items, machines, FOV, lighting, status effects)
- ~2300 tests providing a safety net for refactoring
- TypeScript is web-native: browser, Node terminal, Electron desktop, Capacitor mobile
- Game logic features (simulation, terrain, game modes) build directly on existing code
- Bespoke engine enables unique feel — not constrained by Godot/Unity conventions
- Estimated time to add all listed features: ~3-4 months

**Weaknesses:**
- Presentation layer (rendering, animation, audio) must be built or integrated via libraries
- No visual editors for animation timelines, particle systems, tilemaps
- Isometric rendering is doable but not turnkey
- Code is deeply coupled to Brogue's specific rules — refactoring needed to make systems configurable

**Mitigation:** Use Pixi.js (or similar) as rendering backend instead of raw Canvas2D. This covers WebGL rendering, sprite animation, particle systems, blend modes.

### Option B: Port game logic to Godot

**Strengths:**
- Built-in isometric TileMap, AnimationPlayer, GPUParticles2D, audio
- Visual editors for content authoring
- Export to web, desktop, mobile
- Large community and plugin ecosystem

**Weaknesses:**
- Porting game logic from TS to GDScript/C#: estimated 2-3 months
- Test suite (~2300 tests) would need to be ported or abandoned
- GDScript is less expressive than TS for complex game logic; C# is more verbose
- Long period with nothing playable during port
- Godot's web export ships a large WASM bundle and requires WebGL2
- Games built in Godot tend to feel like Godot games — works against uniqueness goal
- Estimated total time (port + features): ~5-6 months

### Option C: Write from scratch

**Strengths:**
- Clean architecture designed for target game's actual needs
- No legacy coupling to Brogue's rules

**Weaknesses:**
- Loses 6+ months of working, tested game logic
- Must re-derive dungeon generation, monster AI, FOV, pathfinding, status effects, combat
- Slowest path to a playable game unless the target is architecturally very different from a grid roguelike

## Decision Framework

Three questions to filter the decision:

1. **What's the game's core identity?**
   - Deep simulation / emergent gameplay → stay in TS (game logic is the differentiator)
   - Rich visual presentation / "feel" → consider Godot (tooling advantage)

2. **What's the rendering ceiling?**
   - 2D (top-down, isometric, stylized) → TS + Pixi.js is sufficient
   - 3D → Godot, no contest

3. **Where do players play it?**
   - Browser-first → TS is unambiguously right (best distribution, no WASM bundle)
   - Desktop/mobile first → either works; Godot has better export tooling

## Feature-by-feature analysis

### Game logic features (favor staying in TS)

**Terrain destruction/building:** Brogue's `pmap` grid and `dungeonFeature`
system are already a terrain simulation engine. Missing pieces for DF-like
building: player-initiated placement, resource/material model, optionally
structural integrity. All pure game code — engine doesn't help.

**Deeper simulation:** Fire propagation, gas diffusion, light attenuation,
creature ecology already exist. Extending with temperature, water pressure,
NPC relationships, etc. is algorithms and data structures. Platform-agnostic.

**Networking:** Turn-based grid games are among the easiest to network.
Lockstep or client-server both viable. WebSocket is native to TS/browser.
socket.io, PartyKit, or raw WebSocket all mature options.

### Presentation features (require investment in TS)

**Isometric:** Rendering transform applied on top of existing 2D grid logic.
Costs: coordinate transform system, y-depth sorting, tile stacking for walls,
asset pipeline for isometric sprites. Estimated: 2-4 weeks with Pixi.js.

**Animations:** Sprite animation state machines + spritesheet support. Pixi.js
has `AnimatedSprite`. Estimated: 1-2 weeks for the system, ongoing for content.

**Particle effects:** Pixi.js has `ParticleContainer` and community particle
plugins. Basic system: 1 week. Polished with emitter shapes and pooling: 2 weeks.

**Audio:** Howler.js is the industry standard for web game audio. Integration:
~1 week.

**Real-time movement:** Game loop refactor from input-blocking to tick-based.
Movement interpolation between grid cells. Monster AI on timers. Estimated:
2-3 weeks for the loop refactor, ongoing tuning.

## Recommended TS library stack

| Need | Library | Maturity |
|------|---------|----------|
| 2D rendering (WebGL) | Pixi.js | Extremely mature |
| Audio | Howler.js | Industry standard |
| Networking | Native WebSocket / socket.io / PartyKit | Excellent |
| Desktop packaging | Electron or Tauri | Mature |
| Mobile wrapping | Capacitor | Viable for grid games |

## Key insight

The feature wishlist splits ~60/40 between game logic and presentation.
Game logic is the differentiating work — the part that makes a game feel
unlike 100 others. Presentation can be iterated on. The existing codebase
is a genuine head start on the hard, unique part.

The trap to avoid: building the presentation layer from raw Canvas2D. Use
Pixi.js (or equivalent) as the rendering backend to sidestep most "engine"
work while keeping full control of game logic.

## Conclusion

Stay in TypeScript. Invest in rendering via Pixi.js. Build game logic
features on the existing codebase. Revisit if requirements shift to 3D
or if presentation needs consistently outweigh game logic needs.
