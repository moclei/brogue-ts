# Pixel Art Open Source Research

Parent exploration: `docs/pixel-art/pixel-art-exploration.md` (Section 3)

## Intent

Study how other open source roguelike projects solve tile rendering problems — autotiling,
layer compositing, creature facing, and tinting — to inform the design of BrogueCE's pixel
art rendering system. Extract actionable patterns, algorithms, and architectural decisions
rather than reinventing solutions that already exist.

## Goals

- For each deep-dive candidate (BrogueCE `tiles.c`, DCSS, Cataclysm: DDA), produce a
  structured findings section in `docs/pixel-art/pixel-art-exploration.md` Section 3 that
  answers the specific questions listed for that candidate.
- Identify concrete patterns, algorithms, or code structures we can adopt or adapt.
- Determine which autotile algorithm to use (4-bit cardinal vs. 8-bit blob) with evidence
  from how production roguelikes actually implement it.
- Understand layer compositing models used in practice and how they map to Brogue's needs.
- Resolve or narrow the open questions in Section 7 that depend on this research.
- Produce a final synthesis document (appended to Section 3) summarizing recommendations
  for Initiatives 1–4 and 8 in the roadmap.

## Scope

What's in:
- Source-level study of `tiles.c` (already in repo)
- Source-level study of DCSS tile rendering (`tileview.cc`, `rltiles/`, tile creation docs)
- Source-level study of CDDA tile system (`cata_tiles.cpp`, `sdltiles.cpp`, `TILESET.md`,
  `layering.json`, autotile templates and tooling)
- Cross-referencing findings against our Section 4 technical challenges
- Updating `pixel-art-exploration.md` Sections 3, 6, and 7 with findings

What's out:
- Writing code for BrogueCE (this initiative is research only)
- Creating new renderer implementations
- Downloading or studying art assets (we're studying code and architecture, not art)
- Deep study of reference-tier or skip-tier candidates (already documented in Section 3)
- Modifying any TypeScript code in `rogue-ts/`

## Constraints

- **Context window management:** Each session must stay under ~60% context window usage.
  External codebases are large — sessions must be tightly scoped to specific files and
  questions. If a session approaches the limit, it must stop, update TASKS.md with progress,
  commit, and generate a handoff prompt for the next session.
- **Clone strategy:** Clone external repos with `--depth 1 --filter=blob:none` and only
  checkout the specific files/directories needed. Delete clones after study.
- **No code changes to BrogueCE:** This initiative only produces documentation updates.
- **Findings go in pixel-art-exploration.md:** Not in separate files. Section 3 is the
  single source of truth.
