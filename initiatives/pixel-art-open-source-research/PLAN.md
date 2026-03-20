# Pixel Art Open Source Research — Plan

## Approach

Three external codebases to study, each in a dedicated session (or pair of sessions if the
codebase is large). The local `tiles.c` is studied first since it requires no setup. Then
DCSS, then CDDA. A final synthesis session cross-references all findings.

Each session follows this pattern:
1. Clone or access the source (for external repos: shallow clone, sparse checkout)
2. Read the specific files listed in the task, focused on the listed questions
3. Document findings directly in `docs/pixel-art/pixel-art-exploration.md` Section 3
4. If approaching ~60% context window usage, stop — update TASKS.md, commit, write a
   handoff prompt in the `## Session Notes` section below

### Clone Strategy

External repos are cloned into a temporary `_research/` directory (gitignored) at the
repo root. Each clone uses minimal fetch:

```bash
# DCSS (only need crawl-ref/source/tileview.cc, crawl-ref/source/rltiles/, crawl-ref/docs/)
git clone --depth 1 --filter=blob:none --sparse https://github.com/crawl/crawl.git _research/crawl
cd _research/crawl
git sparse-checkout set crawl-ref/source/tileview.cc crawl-ref/source/rltiles crawl-ref/docs/develop/tiles_creation.txt

# CDDA (only need src/cata_tiles.cpp, src/sdltiles.cpp, doc/TILESET.md, data/)
git clone --depth 1 --filter=blob:none --sparse https://github.com/CleverRaven/Cataclysm-DDA.git _research/cdda
cd _research/cdda
git sparse-checkout set src/cata_tiles.cpp src/sdltiles.cpp doc/TILESET.md
```

After study, delete with `rm -rf _research/`.

### What to Extract Per Candidate

For each candidate, answer the specific questions listed in Section 3 of
`pixel-art-exploration.md`, and additionally look for:

1. **Autotiling:** Algorithm, data structures, where computed, how cached/invalidated
2. **Layer compositing:** How many layers, ordering, blend modes, performance
3. **Creature rendering:** Facing direction, sprite selection, animation
4. **Tinting/coloring:** How color is applied to sprites, white vs. colored sprites
5. **Architecture:** Renderer interface, how tile selection is separated from drawing

### Output Format

Findings are written into the existing Section 3 entries in `pixel-art-exploration.md`,
replacing the "Preliminary findings" and "What to study" fields with detailed "Deep-dive
findings" sections. The synthesis task adds a new subsection `### 3.S. Synthesis and
Recommendations` at the end of Section 3.

## Technical Notes

### Context Window Budget

Each session should target:
- **tiles.c session:** ~20-30% context. The file is 813 lines and already in-repo. Quick.
- **DCSS session:** ~40-50% context. `tileview.cc` is 1542 lines. May need to read parts
  of the rltiles config files. If the tile creation docs are long, skim rather than read
  fully.
- **CDDA session:** ~40-50% context. `cata_tiles.cpp` size unknown but likely large.
  Focus on the autotile selection logic, not the entire rendering pipeline. `TILESET.md`
  documentation may be long — use the online version already reviewed in preliminary scan.
- **Synthesis session:** ~20-30% context. Re-read Section 3 findings and Section 4
  challenges. Write cross-references and recommendations.

If a session needs to be split (e.g., CDDA's `cata_tiles.cpp` is too large), the task
description in TASKS.md should specify which functions/sections to focus on.

### Key Files Per Candidate

**tiles.c (local):**
- `src/platform/tiles.c` — already read in preliminary scan

**DCSS:**
- `crawl-ref/source/tileview.cc` — tile selection, flavour, autotiling
- `crawl-ref/source/rltiles/dc-dngn.txt` — dungeon tile definitions (how tiles are named)
- `crawl-ref/docs/develop/tiles_creation.txt` — design guide
- Possibly: `crawl-ref/source/tilepick.cc` — if tileview.cc references it for selection

**CDDA:**
- `src/cata_tiles.cpp` — tile selection and multitile logic
- `src/sdltiles.cpp` — SDL rendering pipeline
- `doc/TILESET.md` — format specification (already reviewed online)
- A sample `tile_config.json` from an actual tileset (to see the format in practice)
- `layering.json` from a tileset (if it exists in data/)

## Open Questions

- ~~How large is `cata_tiles.cpp`? If it's 3000+ lines, the CDDA session may need to be
  split into two: one for the multitile/autotile logic, one for the rendering pipeline.~~
  **Resolved (Phase 3):** 5557 lines. Focused on multitile selection logic in one session.
  General rendering infrastructure (sprite drawing, texture management) was skipped —
  not needed for our design decisions. The critical functions are `get_rotation_and_subtile`
  (4-bit bitmask → subtile+rotation) and `get_connect_values` (connect_group neighbor check).
- ~~Does DCSS have a separate `tilepick.cc` or similar that handles tile selection logic
  distinct from `tileview.cc`? The preliminary scan only found `tileview.cc`.~~
  **Resolved (Phase 2):** Yes. `tilepick.cc` (5179 lines) handles all feature/monster/item
  → tile mapping plus `apply_variations()`. `tilepick-p.cc` (1235 lines) handles player
  doll equipment. `tileview.cc` handles flavour init, floor halos, and animations.

## Rejected Approaches

_(none yet)_

## Session Notes

### Phase 2 — DCSS Deep-Dive

Key findings that affect future phases:

- **DCSS does NOT use bitmask autotiling for walls/floors.** It uses weighted random variant
  selection per cell, computed once at level generation. The only bitmask logic is for web
  traps (4-bit cardinal). Floor halos use a 9-tile directional overlay system.
- **3-layer model (bg/fg/cloud) + flags**, not the deep compositing stack we anticipated.
  Our 11-layer proposal may be overkill — need to validate against CDDA in Phase 3.
- **No creature facing direction at all.** All monsters face one fixed direction by
  convention. Our 2-directional flip plan already exceeds DCSS.
- **No runtime tinting.** All color baked at build time via rltiles `%hue`/`%lum`/`%desat`.
  This is a fundamental difference from Brogue where per-cell lighting requires runtime tint.
- `tileview.cc` is 1328 lines (not 1542 as originally noted in PLAN.md).
- `tilepick.cc` (5179 lines) is the real tile selection brain. Worth noting for CDDA
  comparison — does CDDA split tile selection similarly?

### Phase 3 — CDDA Deep-Dive

Key findings that affect Phase 4 synthesis:

- **CDDA uses 4-bit cardinal bitmask (16 tiles), not 8-bit blob (47 tiles).** The most
  feature-rich open-source roguelike autotile system chose the simpler approach. 6 subtile
  types × rotations = 16 unique visuals per terrain type. This strongly suggests 4-bit
  is sufficient for our needs.
- **connect_groups system is the key differentiator.** Not just same-type matching — tiles
  connect to *groups* of types (all walls connect to each other, doors connect to walls).
  We need this for Brogue where walls, doors, and doorframes should visually connect.
- **11 draw layers validates our 11-layer proposal.** CDDA and Brogue both need ~11 layers,
  though the specific layers differ. Our proposal is not overkill.
- **CDDA has 2-directional creature facing (left/right flip).** Combined with DCSS having
  no facing at all, 2-directional is clearly the right choice for our system.
- **No runtime tinting (same as DCSS).** Pre-baked texture variants for lighting states.
  Neither DCSS nor CDDA has Brogue's continuous per-cell RGB lighting. We're implementing
  something neither reference project needed.
- **`layering.json` is narrower than expected.** Context-sensitive item sprite overrides,
  not a general layer ordering system.
- **The 4x4 template + slice_multitile.py tooling is directly adoptable** for our art
  pipeline. Author one template image, slice into 16 named connection sprites + JSON.

### Phase 4 — Synthesis

All four phases complete. Key decisions documented in Section 3.S of pixel-art-exploration.md:
- **Autotiling:** 8-bit blob (47 tiles) — user preference for inner corner quality over
  CDDA's simpler 4-bit approach. Connection groups adopted from CDDA.
- **Creature facing:** 2-directional (left/right flip)
- **Tinting:** White sprites for production, Qud 3-color worth prototyping
- **Layers:** 11-layer stack validated
- **Architecture:** CDDA-style layer function array pattern for SpriteRenderer

Section 7 (Open Questions): 6 resolved, 6 still open, 3 new. Section 6 (Roadmap) updated.
Section 5 (Decisions Log) updated with 5 research decisions. Initiative is complete.
