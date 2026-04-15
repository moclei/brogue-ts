/*
 *  io/sidebar-dom-builder.ts — Extract SidebarRenderData from live game state
 *  Port V2 — rogue-ts / ui-extraction Phase 1
 *
 *  Provides:
 *    buildSidebarRenderData(ctx, focusX, focusY) → SidebarRenderData
 *
 *  Called after refreshSideBar() (which populates sidebarLocationList and
 *  writes to the display buffer). Reads the same game state to produce a
 *  serializable SidebarRenderData for DOM rendering.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature, Item } from "../types/types.js";
import { StatusEffect, CreatureState } from "../types/enums.js";
import {
    ROWS, STOMACH_SIZE, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD,
    COLOR_ESCAPE,
} from "../types/constants.js";
import { TileFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag, TerrainMechFlag } from "../types/flags.js";
import {
    EntityDisplayType,
    type SidebarContext,
    creatureHealthChangePercent,
} from "./sidebar-player.js";
import { collectSidebarEntities } from "./sidebar-monsters.js";
import { glyphToUnicode } from "../platform/glyph-map.js";
import type {
    SidebarRenderData, SidebarEntityData, ProgressBarData, TextLineData, CssRgb,
} from "../platform/ui-sidebar.js";

// =============================================================================
// Color helpers
// =============================================================================

/** Convert a Brogue Color (0–100 per channel) to a CssRgb (0–255), clamped. */
function colorToCss(c: Readonly<Color>, dim = false): CssRgb {
    const scale = dim ? 0.5 : 1.0;
    const r = Math.max(0, Math.min(100, c.red));
    const g = Math.max(0, Math.min(100, c.green));
    const b = Math.max(0, Math.min(100, c.blue));
    return {
        r: Math.round(r * 255 / 100 * scale),
        g: Math.round(g * 255 / 100 * scale),
        b: Math.round(b * 255 / 100 * scale),
    };
}

/** Blend two CssRgb colors: `a * (1 - t) + b * t`. */
function blendCss(a: CssRgb, b: CssRgb, t: number): CssRgb {
    const s = Math.max(0, Math.min(1, t));
    return {
        r: Math.round(a.r * (1 - s) + b.r * s),
        g: Math.round(a.g * (1 - s) + b.g * s),
        b: Math.round(a.b * (1 - s) + b.b * s),
    };
}

/** Strip 4-byte Brogue color escape sequences from a string. */
function stripEscapes(s: string): string {
    let out = "";
    let i = 0;
    while (i < s.length) {
        if (s.charCodeAt(i) === COLOR_ESCAPE) {
            i += 4;
        } else {
            out += s[i++];
        }
    }
    return out;
}

/** Convert a DisplayGlyph to a single Unicode character string. */
function glyphChar(glyph: number): string {
    return String.fromCodePoint(glyphToUnicode(glyph as import("../types/enums.js").DisplayGlyph));
}

// Pre-computed CSS colors for sidebar bar fills
const CSS_BLUE_BAR:   CssRgb = { r: 38,  g: 26,  b: 128 };
const CSS_RED_BAR:    CssRgb = { r: 115, g: 26,  b: 38 };
const CSS_WHITE:      CssRgb = { r: 255, g: 255, b: 255 };
const CSS_GRAY:       CssRgb = { r: 128, g: 128, b: 128 };
const CSS_DARK_GRAY:  CssRgb = { r: 77,  g: 77,  b: 77 };
const CSS_BAD_MSG:    CssRgb = { r: 255, g: 128, b: 153 };
const CSS_FLAVOR:     CssRgb = { r: 128, g: 102, b: 230 };

// =============================================================================
// Row-range helpers — read sidebarLocationList populated by refreshSideBar
// =============================================================================

/** Build a map from "x,y" key → { start, count } from sidebarLocationList. */
function buildRowRangeMap(ctx: SidebarContext): Map<string, { start: number; count: number }> {
    const map = new Map<string, { start: number; count: number }>();
    const list = ctx.rogue.sidebarLocationList;
    for (let i = 0; i < ROWS - 1; i++) {
        const loc = list[i];
        if (loc.x < 0) continue;
        const key = `${loc.x},${loc.y}`;
        const existing = map.get(key);
        if (existing) {
            existing.count++;
        } else {
            map.set(key, { start: i, count: 1 });
        }
    }
    return map;
}

// =============================================================================
// Creature entity builder
// =============================================================================

function buildCreatureEntityData(
    monst: Creature,
    dim: boolean,
    focused: boolean,
    rowStart: number,
    rowCount: number,
    ctx: SidebarContext,
): SidebarEntityData {
    const isPlayer = monst === ctx.player;
    const inPath = !!(ctx.pmap[monst.loc.x][monst.loc.y].flags & TileFlag.IS_IN_PATH);

    // Temporarily remove IS_IN_PATH for accurate appearance
    ctx.pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.IS_IN_PATH;
    const appearance = ctx.getCellAppearance(monst.loc);
    if (inPath) {
        ctx.pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.IS_IN_PATH;
    }

    const glyphForeColor = colorToCss(appearance.foreColor, dim);
    const glyphBackColor = colorToCss(appearance.backColor, dim);

    // Name
    let rawName = ctx.monsterName(monst, false);
    rawName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    if (isPlayer) {
        if (ctx.player.status[StatusEffect.Invisible]) {
            rawName += " (invisible)";
        } else if (ctx.playerInDarkness()) {
            rawName += " (dark)";
        }
    }
    const nameText = stripEscapes(rawName);

    // Carried item
    let carriedItemChar: string | undefined;
    let carriedItemColor: CssRgb | undefined;
    if (monst.carriedItem) {
        carriedItemChar = glyphChar(monst.carriedItem.displayChar as number);
        carriedItemColor = { r: 255, g: 242, b: 0 }; // itemColor after clamping
    }

    // --- Progress bars ---
    const bars: ProgressBarData[] = [];

    // Health bar
    if (monst.info.maxHP > 1 && !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        const hpFrac = Math.max(0, monst.currentHP / monst.info.maxHP);

        let fillColor: CssRgb;
        if (isPlayer) {
            // Blend redBar→blueBar based on current HP ratio
            fillColor = blendCss(CSS_RED_BAR, CSS_BLUE_BAR, hpFrac);
        } else {
            fillColor = { ...CSS_BLUE_BAR };
        }
        const emptyColor: CssRgb = {
            r: Math.round(fillColor.r * 0.25),
            g: Math.round(fillColor.g * 0.25),
            b: Math.round(fillColor.b * 0.25),
        };

        const pct = creatureHealthChangePercent(monst);
        let healthLabel: string;
        if (monst.currentHP <= 0) {
            healthLabel = "Dead";
        } else if (pct !== 0) {
            healthLabel = `Health (${pct > 0 ? "+" : ""}${pct}%)`;
        } else {
            healthLabel = "Health";
        }

        bars.push({
            label: healthLabel,
            fraction: hpFrac,
            fillColor,
            emptyColor,
        });
    }

    // Nutrition bar (player only)
    if (isPlayer) {
        const nutrition = ctx.player.status[StatusEffect.Nutrition];
        if (nutrition > 0) {
            let label = "Nutrition";
            if (nutrition <= FAINT_THRESHOLD) {
                label = "Nutrition (Faint)";
            } else if (nutrition <= WEAK_THRESHOLD) {
                label = "Nutrition (Weak)";
            } else if (nutrition <= HUNGER_THRESHOLD) {
                label = "Nutrition (Hungry)";
            }
            bars.push({
                label,
                fraction: nutrition / STOMACH_SIZE,
                fillColor: { ...CSS_BLUE_BAR },
                emptyColor: { r: 10, g: 7, b: 35 },
            });
        }
    }

    // Status effect bars
    const hallucinating = !!ctx.player.status[StatusEffect.Hallucinating];
    const showStatus = !hallucinating || ctx.rogue.playbackOmniscience || isPlayer;
    if (showStatus) {
        for (let i = 0; i < StatusEffect.NumberOfStatusEffects; i++) {
            if (monst.status[i] <= 0) continue;
            const effName = ctx.statusEffectCatalog[i].name;
            if (!effName) continue;

            let label: string;
            const isRed = (
                i === StatusEffect.Weakened ||
                i === StatusEffect.Levitating ||
                i === StatusEffect.Poisoned ||
                (i !== StatusEffect.Nutrition && i !== StatusEffect.Searching)
            );
            const barFill: CssRgb = isRed ? { ...CSS_RED_BAR } : { ...CSS_BLUE_BAR };
            const barEmpty: CssRgb = {
                r: Math.round(barFill.r * 0.25),
                g: Math.round(barFill.g * 0.25),
                b: Math.round(barFill.b * 0.25),
            };

            if (i === StatusEffect.Weakened) {
                label = `${effName}${monst.weaknessAmount}`;
            } else if (i === StatusEffect.Levitating) {
                label = isPlayer ? "Levitating" : "Flying";
            } else if (i === StatusEffect.Poisoned) {
                const poisonLabel = monst.status[i] * monst.poisonAmount >= monst.currentHP
                    ? "Fatal Poison" : "Poisoned";
                label = monst.poisonAmount === 1
                    ? poisonLabel : `${poisonLabel} (x${monst.poisonAmount})`;
            } else {
                label = effName;
            }

            bars.push({
                label,
                fraction: monst.status[i] / (monst.maxStatus[i] || 1),
                fillColor: barFill,
                emptyColor: barEmpty,
            });
        }

        // Absorption bar
        if (
            monst.targetCorpseLoc.x === monst.loc.x &&
            monst.targetCorpseLoc.y === monst.loc.y &&
            ctx.monsterText[monst.info.monsterID]?.absorbStatus
        ) {
            bars.push({
                label: ctx.monsterText[monst.info.monsterID].absorbStatus,
                fraction: monst.corpseAbsorptionCounter / 20,
                fillColor: { ...CSS_RED_BAR },
                emptyColor: { r: 29, g: 7, b: 10 },
            });
        }
    }

    // --- Extra text lines ---
    const lines: TextLineData[] = [];
    const lineColor = dim ? CSS_DARK_GRAY : CSS_GRAY;

    // Mutation line
    if (
        monst.mutationIndex >= 0 &&
        (!hallucinating || ctx.rogue.playbackOmniscience)
    ) {
        const mutation = ctx.mutationCatalog[monst.mutationIndex];
        lines.push({
            text: `(${mutation.title})`,
            color: colorToCss(mutation.textColor, dim),
        });
    }

    if (isPlayer) {
        // Nutrition starving text (when nutrition == 0)
        if (ctx.player.status[StatusEffect.Nutrition] === 0) {
            lines.push({ text: "STARVING", color: CSS_BAD_MSG });
        }

        // Str / Armor
        const str = ctx.rogue.strength - ctx.player.weaknessAmount;
        const armor = ctx.rogue.armor && !ctx.rogue.playbackOmniscience
            ? `${ctx.estimatedArmorValue()}?`
            : `${ctx.displayedArmorValue()}`;
        lines.push({
            text: `Str: ${str}  Armor: ${armor}`,
            color: dim ? CSS_DARK_GRAY : CSS_GRAY,
        });

        // Gold
        if (ctx.rogue.gold) {
            lines.push({
                text: `Gold: ${ctx.rogue.gold}`,
                color: dim ? CSS_DARK_GRAY : CSS_GRAY,
            });
        }

        // Stealth range
        const pct = Math.trunc((ctx.rogue.stealthRange - 2) * 100 / 28);
        // Blend playerInShadowColor → playerInLightColor based on pct
        const stealthColor: CssRgb = {
            r: Math.round(30 + pct * (255 - 30) / 100),
            g: Math.round(180 + pct * (255 - 180) / 100),
            b: Math.round(255 - pct * 180 / 100),
        };
        lines.push({
            text: `Stealth range: ${ctx.rogue.stealthRange}`,
            color: dim ? CSS_DARK_GRAY : stealthColor,
        });
    } else {
        // Monster behavior line
        if (!(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) && showStatus) {
            let behavior: string | null = null;
            if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
                behavior = "(Captive)";
            } else if (
                (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
                !ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
            ) {
                behavior = "(Helpless)";
            } else if (monst.creatureState === CreatureState.Sleeping) {
                behavior = "(Sleeping)";
            } else if (monst.creatureState === CreatureState.Ally) {
                behavior = "(Ally)";
            } else if (monst.creatureState === CreatureState.Fleeing) {
                behavior = "(Fleeing)";
            } else if (monst.creatureState === CreatureState.Wandering) {
                if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
                    monst.leader &&
                    (monst.leader.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)
                ) {
                    behavior = "(Worshiping)";
                } else if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
                    monst.leader &&
                    (monst.leader.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
                ) {
                    behavior = "(Guarding)";
                } else {
                    behavior = "(Wandering)";
                }
            } else if (monst.creatureState === CreatureState.TrackingScent) {
                behavior = "(Hunting)";
            }
            if (behavior) {
                lines.push({ text: behavior, color: lineColor });
            }
        }
    }

    return {
        type: "creature",
        mapX: monst.loc.x,
        mapY: monst.loc.y,
        sidebarRowStart: rowStart,
        sidebarRowCount: rowCount,
        glyphChar: glyphChar(appearance.glyph as number),
        glyphForeColor,
        glyphBackColor,
        carriedItemChar,
        carriedItemColor,
        nameText,
        nameColor: dim ? CSS_DARK_GRAY : CSS_WHITE,
        dim,
        focused,
        bars,
        lines,
    };
}

// =============================================================================
// Item entity builder
// =============================================================================

function buildItemEntityData(
    theItem: Item,
    dim: boolean,
    focused: boolean,
    rowStart: number,
    rowCount: number,
    ctx: SidebarContext,
): SidebarEntityData {
    const inPath = !!(ctx.pmap[theItem.loc.x][theItem.loc.y].flags & TileFlag.IS_IN_PATH);
    ctx.pmap[theItem.loc.x][theItem.loc.y].flags &= ~TileFlag.IS_IN_PATH;
    const appearance = ctx.getCellAppearance(theItem.loc);
    if (inPath) {
        ctx.pmap[theItem.loc.x][theItem.loc.y].flags |= TileFlag.IS_IN_PATH;
    }

    let nameText: string;
    if (ctx.rogue.playbackOmniscience || !ctx.player.status[StatusEffect.Hallucinating]) {
        nameText = stripEscapes(ctx.itemName(theItem, true, true));
    } else {
        nameText = stripEscapes(ctx.describeHallucinatedItem());
    }
    nameText = nameText.charAt(0).toUpperCase() + nameText.slice(1);

    return {
        type: "item",
        mapX: theItem.loc.x,
        mapY: theItem.loc.y,
        sidebarRowStart: rowStart,
        sidebarRowCount: rowCount,
        glyphChar: glyphChar(appearance.glyph as number),
        glyphForeColor: colorToCss(appearance.foreColor, dim),
        glyphBackColor: colorToCss(appearance.backColor, dim),
        nameText,
        nameColor: dim ? CSS_DARK_GRAY : CSS_GRAY,
        dim,
        focused,
        bars: [],
        lines: [],
    };
}

// =============================================================================
// Terrain entity builder
// =============================================================================

function buildTerrainEntityData(
    x: number,
    y: number,
    description: string,
    dim: boolean,
    focused: boolean,
    rowStart: number,
    rowCount: number,
    ctx: SidebarContext,
): SidebarEntityData {
    const inPath = !!(ctx.pmap[x][y].flags & TileFlag.IS_IN_PATH);
    ctx.pmap[x][y].flags &= ~TileFlag.IS_IN_PATH;
    const appearance = ctx.getCellAppearance({ x, y });
    if (inPath) {
        ctx.pmap[x][y].flags |= TileFlag.IS_IN_PATH;
    }

    return {
        type: "terrain",
        mapX: x,
        mapY: y,
        sidebarRowStart: rowStart,
        sidebarRowCount: rowCount,
        glyphChar: glyphChar(appearance.glyph as number),
        glyphForeColor: colorToCss(appearance.foreColor, dim),
        glyphBackColor: colorToCss(appearance.backColor, dim),
        nameText: description.charAt(0).toUpperCase() + description.slice(1),
        nameColor: dim ? CSS_DARK_GRAY : CSS_FLAVOR,
        dim,
        focused,
        bars: [],
        lines: [],
    };
}

// =============================================================================
// buildSidebarRenderData — main entry point
// =============================================================================

/**
 * Build a `SidebarRenderData` snapshot from the current game state.
 * Call AFTER `refreshSideBar()` so that `sidebarLocationList` is populated.
 *
 * @param ctx   - Current SidebarContext (from buildSidebarContext())
 * @param focusX - Focused dungeon X (or -1 for none)
 * @param focusY - Focused dungeon Y
 */
export function buildSidebarRenderData(
    ctx: SidebarContext,
    focusX: number,
    focusY: number,
): SidebarRenderData {
    // Playback header
    let playbackHeader: SidebarRenderData["playbackHeader"];
    if (ctx.rogue.playbackMode) {
        const turnFraction = ctx.rogue.howManyTurns > 0
            ? ctx.rogue.playerTurnNumber / ctx.rogue.howManyTurns
            : 0;
        playbackHeader = {
            turnLabel: `Turn ${ctx.rogue.playerTurnNumber}/${ctx.rogue.howManyTurns}`,
            turnFraction,
            paused: ctx.rogue.playbackPaused,
            outOfSync: ctx.rogue.playbackOOS,
        };
    }

    // Determine focus entity
    const hasFocus = focusX >= 0;

    // Collect entities (same logic as refreshSideBar)
    const rawEntities = collectSidebarEntities(focusX, focusY, false, ctx);

    // Read row ranges from sidebarLocationList (populated by refreshSideBar)
    const rowRanges = buildRowRangeMap(ctx);

    const entities: SidebarEntityData[] = [];
    let gotFocusedEntityOnScreen = !hasFocus;

    for (const entity of rawEntities) {
        const key = `${entity.x},${entity.y}`;
        const range = rowRanges.get(key) ?? { start: 0, count: 1 };

        const isFocused = hasFocus && entity.x === focusX && entity.y === focusY;
        const isDimmed = hasFocus && !isFocused;

        if (isFocused) gotFocusedEntityOnScreen = true;

        let data: SidebarEntityData;
        if (entity.type === EntityDisplayType.Creature && entity.creature) {
            data = buildCreatureEntityData(
                entity.creature, isDimmed, isFocused,
                range.start, range.count, ctx,
            );
        } else if (entity.type === EntityDisplayType.Item && entity.item) {
            data = buildItemEntityData(
                entity.item, isDimmed, isFocused,
                range.start, range.count, ctx,
            );
        } else if (entity.type === EntityDisplayType.Terrain && entity.terrainDescription) {
            data = buildTerrainEntityData(
                entity.x, entity.y, entity.terrainDescription,
                isDimmed, isFocused, range.start, range.count, ctx,
            );
        } else {
            continue;
        }

        entities.push(data);
    }

    return {
        playbackHeader,
        entities,
        depthLevel: ctx.rogue.depthLevel,
        showDepthFooter: gotFocusedEntityOnScreen,
    };
}
