# Implementation Stubs Snapshot

**Date:** 2026-03-03 (after Playtest Round 1, Sessions A–E)  
**Codebase:** 118 TS source files, ~57K lines, 2,264 tests passing  
**Purpose:** Catalog all stubs, simplified implementations, and no-ops remaining in the TypeScript port.

---

## Legend

| Tag | Meaning |
|-----|---------|
| 🔴 **Stub** | Empty / no-op — the feature does nothing |
| 🟡 **Simplified** | Partial implementation — works for basic cases but missing C behaviors |
| 🟢 **No-op (OK)** | Intentionally empty (GC, browser N/A, etc.) — no action needed |
| 📍 | Location is in `ts/src/runtime.ts` unless otherwise noted |

---

## 1. Player Item Actions

These are the actions available from the inventory detail panel. Players encounter these directly.

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🔴 `apply()` | ~6632 | **High** — can't read scrolls, drink potions, zap wands/staffs, use charms | Full item-use dispatch: scroll effects, potion effects, wand/staff bolt targeting + animation, charm activation |
| 🔴 `throwCommand()` | ~6651 | **High** — can't throw items | Targeting system (`io-targeting.ts` wiring), projectile animation, damage on impact |
| 🔴 `relabel()` | ~6666 | Low — cosmetic only | Text input via `getInputTextString`, reassign inventory letter |
| 🔴 `call()` | ~6681 | Low — cosmetic only | Text input via `getInputTextString`, set custom item/category name |
| 🔴 `swap()` | ~6737 | Medium — can't swap equipped ring | Needs ring slot swap logic |
| 🔴 `saveGame()` | ~6743 | Medium — no save/load | Serialization of full game state |

---

## 2. Monster AI

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🟡 `monstersTurn()` | ~5992 | **High** — monsters only track scent, flee, wander, sleep | Full `monstersTurn` from `monster-actions.ts`: ranged attacks, ability usage, summoning, ally behaviors, leader/follower logic, special abilities (MA_ flags) |
| 🟡 `monstersAreEnemies()` | ~4793 | Medium — always returns `true` | Full version checks ally state, discord, etc. |
| 🔴 `restoreMonster()` | ~5631, ~3235 | Medium — monsters from previous levels not restored on return | Wire full `restoreMonster` from `architect.ts` |
| 🟡 `moveMonster` (ally swap) | ~5457 | Low — simplified push/swap logic | Full `moveMonster` for ally movement and tile interactions |

---

## 3. Vision & FOV

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🟡 `updateVision()` | ~1343 | **High** — simplified FOV, no proper light-based visibility | Full `updateVision` from C's `Light.c`: light sources, darkness, torch radius, telepathy, clairvoyance, omniscience |
| 🔴 `demoteVisibility()` | ~4927, ~6312 | Medium — old visible cells not properly cleared | Wire to FOV system so cells lose VISIBLE flag when out of sight |
| 🟡 Telepathic reveal | ~5969 | Low — `MB_TELEPATHICALLY_REVEALED` always `false` | Wire to telepathy/clairvoyance checks |

---

## 4. Lighting

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🟡 `updateLighting()` | ~4272 | **High** — no dynamic lighting from torches, lava, magical lights | Full `updateLighting` from `Light.c`: per-cell light accumulation, color blending, light source grid |
| 🔴 `updateMinersLightRadius()` | ~2250 | Medium — miner's light ring bonus doesn't update | Calculate light radius from equipped ring of light |

---

## 5. Scent & Pathfinding

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🔴 Scent map update | ~6320 | **High** — monsters can't properly track player by scent over distance | Wire `scentMap` updates in `playerTurnEnded` |
| 🔴 `getQualifyingPathLocNear()` | ~6275 | Medium — some monster placements may fail | Wire Dijkstra-based qualifying location search |
| 🟡 Stealth range | ~3104 | Medium — simplified calculation, doesn't account for armor/ring/light | Full `currentStealthRange` from C |

---

## 6. Cell Discovery & Memory

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🔴 `discover()` | ~2477 | Medium — newly seen cells not properly marked as discovered | Set `DISCOVERED` flag, update terrain memory |
| 🔴 `discoverCell()` | ~6331 | Medium — same as above, in turn processing context | Wire to discover logic |
| 🔴 `storeMemory()` | ~6342 | Medium — remembered terrain not stored for fog-of-war | Copy current appearance to `rememberedAppearance` |

---

## 7. Level Transitions

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🔴 `restoreMonster()` | ~751 (`architect.ts`) | Medium — monsters don't persist across levels | Full creature serialization/deserialization |
| 🔴 `restoreItems()` | ~763 (`architect.ts`) | Medium — items don't persist across levels | Full item serialization/deserialization |
| 🟡 `startLevel` AI kick | ~3241 | Low — monster AI not ticked on level entry | Wire `monstersTurn` for initial level setup |

---

## 8. Item System

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🟡 Auto-identification | ~5609 | Medium — items not auto-identified after enough uses | Full `autoIdentify` logic from C's `Items.c` |
| 🟡 Item drift | ~4370 | Low — simplified adjacent-cell search when items land | Full drift algorithm matching C |
| 🟡 `useKeyAt()` | ~4972 | Medium — keys can't unlock cages/doors | Wire to `promoteTile` + key consumption logic |

---

## 9. UI & Display

| Stub | Line | Impact | What's Needed |
|------|------|--------|---------------|
| 🟡 `funkyFade()` | ~5711, ~5869 | Low — death/win screen has basic blackout instead of animated fade | Full color-cycling fade animation |
| 🔴 `handleHealthAlerts()` | ~6373 | Medium — no low-health warnings or hunger alerts | Wire health/hunger threshold checks + flashing messages |
| 🟡 Monster/item description text | ~1748, ~1752 | Low — detail panels show only name, not full description | Port `monsterDetails`/`itemDetails` from C's sidebar code |
| 🟡 Hallucinated item description | ~1701 | Low — always returns "a strange shimmering item" | Random item category + name generation |
| 🔴 `clearCursorPath()` | ~2576 | Low — mouse path preview doesn't clear | Wire to targeting context |
| 🟡 Spear visual overlay | ~5362 | Low — spear attacks don't show directional overlay | Wire to display buffer overlay |
| 🟡 `confirm()` dialog | ~5359 | Medium — always returns `true`, no confirmation prompts | Wire to `io-input` confirm dialog |

---

## 10. Debug Displays

All in `buildInputContext()`. Low priority — developer tools only.

| Stub | Line | Impact |
|------|------|--------|
| 🔴 `displayGrid()` | ~7045 | Dev only |
| 🔴 `displayLoops()` | ~7046 | Dev only |
| 🔴 `displayChokeMap()` | ~7047 | Dev only |
| 🔴 `displayMachines()` | ~7048 | Dev only |
| 🔴 `displayWaypoints()` | ~7049 | Dev only |
| 🔴 `dialogCreateItemOrMonster()` | ~6775 | Dev only |

---

## 11. Recordings & Playback

All no-ops. This is a complete subsystem that hasn't been wired for the browser.

| Stub | Line | Impact |
|------|------|--------|
| 🔴 `saveRecording()` | ~5757 | No game recording |
| 🔴 `saveRecordingNoPrompt()` | ~5758 | No game recording |
| 🔴 `flushBufferToFile()` | ~5754, ~7386 | No file output |
| 🔴 `notifyEvent()` | ~5759 | No event logging |
| 🔴 `saveRunHistory()` | ~5760 | No run history |
| 🔴 `RNGCheck()` | ~6309 | No recording validation |
| 🔴 `executeEvent()` | ~7394 | No playback |
| 🔴 `displayAnnotation()` | ~6236, ~7395 | No playback annotations |
| 🔴 `pausePlayback()` | ~7396 | No playback |

---

## 12. Other Files with Stubs

| File | Stub | Impact |
|------|------|--------|
| `architect/architect.ts:402` | 🟡 `getQualifyingGridLocNear` — simplified expanding-ring search | Low — rare edge cases in monster/item placement |
| `architect/architect.ts:431` | 🟡 `getQualifyingLocNear` — simplified version | Low — same |
| `io/io-targeting.ts:80` | 🔴 Rendering methods stubbed | **High** — targeting overlay doesn't render (blocks Apply wand/staff, Throw) |
| `io/io-effects.ts:364` | 🟡 Simplified tile qualifying in bolt effects | Low — bolts may hit wrong tiles in edge cases |
| `io/io-sidebar.ts:139` | 🟡 Detail text functions may be stubs | Low — sidebar shows basic info |
| `menus/main-menu.ts:305–321` | 🔴 Game lifecycle / recording / playback stubs | Medium — new game from menu works, load/replay don't |
| `recordings/recording-save-load.ts:10` | 🔴 Interactive save functions deferred | Medium — no save/load |

---

## Priority Summary

### Must-have for playable game
1. **Item Apply** — scrolls, potions, wands, staffs, charms (requires targeting for wands/staffs)
2. **Targeting system** — wiring `io-targeting.ts` for Apply + Throw
3. **Full monster AI** — replacing simplified `monstersTurn` with the real implementation
4. **Vision/FOV** — proper light-based visibility instead of simplified FOV
5. **Scent maps** — monsters need to track player properly

### Important for game feel
6. Lighting — dynamic light from torches, lava, glowing creatures
7. Cell discovery/memory — fog-of-war and terrain memory
8. Health alerts — hunger and low-HP warnings
9. Item auto-identification
10. Confirm dialogs

### Nice to have
11. Death/win animations (funkyFade)
12. Full item/monster description text
13. Debug displays
14. Relabel/Call (text input)
15. Save/Load
16. Recordings/Playback
