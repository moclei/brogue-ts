# Relay — planning → orchestrator — 2026-04-14

role:orchestrator

## Context

The UI extraction initiative moves sidebar, messages, bottom bar, and
overlay modals out of the canvas-based `ScreenDisplayBuffer` and into
HTML/DOM elements. This unblocks the dungeon camera initiative (separate,
depends on this one). The initiative was researched in
`docs/game-camera/game-camera-exploration.md`, then planned across two
sessions that produced a thorough BRIEF, PLAN, and TASKS with identified
risks, resolved open questions, and a leaf-to-root extraction order for
overlays.

## Load these files

- .context/PROJECT.md
- .context/PROTOCOL.md
- initiatives/ui-extraction/BRIEF.md
- initiatives/ui-extraction/PLAN.md
- initiatives/ui-extraction/TASKS.md

## State

Branch: master (create `feat/ui-extraction` before starting)
Build: passing
TASKS.md current: yes — all tasks are `[ ]`, none started

## What was done

- Explored the rendering architecture: single `ScreenDisplayBuffer[100][34]`,
  `commitDraws` flush path, `plotChar` per dirty cell, `TextRenderer` vs
  `SpriteRenderer` (sprites only inside `isInDungeonViewport`).
- Audited all overlay surfaces in the codebase (~22 total). Categorized
  into four input patterns: `buttonInputLoop` modals, simple dismissables,
  timed animations, and custom input loops.
- Identified key risks: `displayInventory` two-level drill-down complexity,
  mixed-mode during targeting (canvas highlights + DOM detail panels),
  Phase 3 must complete before Phase 4 (hard dependency), full-grid visual
  effects need audit.
- Decided: DOM modals are always viewport-centered (no spatial anchoring to
  dungeon cells). Visual parity not pixel-identical (no `rectangularShading`
  falloff in DOM). Buffer-write paths kept behind `useDOM` flag as fallback.
- Resolved all open questions in PLAN.md. Phase 3 split into four
  sub-phases (3a–3d) ordered leaf-to-root. Handoff tasks added per protocol.

## Your task

Run the `ui-extraction` initiative. Create branch `feat/ui-extraction`
from master, then begin with Phase 1. Dispatch sub-agents aka Workers to perform the actual work, per our PROTOCOL.md protocol. All open questions are resolved.
TASKS.md is ready for execution.

## Open questions

None — all resolved in PLAN.md.
