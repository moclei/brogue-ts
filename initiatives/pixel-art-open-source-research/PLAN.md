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

- How large is `cata_tiles.cpp`? If it's 3000+ lines, the CDDA session may need to be
  split into two: one for the multitile/autotile logic, one for the rendering pipeline.
- Does DCSS have a separate `tilepick.cc` or similar that handles tile selection logic
  distinct from `tileview.cc`? The preliminary scan only found `tileview.cc`.

## Rejected Approaches

_(none yet)_

## Session Notes

_(updated by each session)_
