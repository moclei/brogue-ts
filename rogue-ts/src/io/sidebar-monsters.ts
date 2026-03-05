/*
 *  sidebar-monsters.ts — Monster info, entity collection, sidebar refresh
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: printMonsterInfo, collectSidebarEntities, refreshSideBar,
 *             printMonsterDetails
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature, Item } from "../types/types.js";
import { StatusEffect, CreatureState, DungeonLayer } from "../types/enums.js";
import {
    ROWS, DCOLS, DROWS,
    STOMACH_SIZE, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD,
} from "../types/constants.js";
import { TileFlag, ItemFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag, TerrainMechFlag } from "../types/flags.js";
import {
    black, white, gray, darkGray, red,
    blueBar, redBar, darkPurple, badMessageColor, pink, darkPink,
    itemColor, playerInShadowColor, playerInLightColor,
} from "../globals/colors.js";
import { strLenWithoutEscapes, printString } from "./text.js";
import { encodeMessageColor, applyColorAverage, applyColorAugment, applyColorBounds } from "./color.js";
import { plotCharWithColor, highlightScreenCell } from "./display.js";
import { coordinatesAreInMap } from "../globals/tables.js";
import {
    EntityDisplayType,
    type SidebarContext,
    type SidebarEntity,
    SIDEBAR_WIDTH,
    smoothHiliteGradient,
    creatureHealthChangePercent,
    printProgressBar,
    printItemInfo,
    printTerrainInfo,
} from "./sidebar-player.js";

// Hallucination behavior strings shown in place of real creature state
const HALLUCINATION_STRINGS: readonly string[] = [
    "     (Dancing)      ", "     (Singing)      ", "  (Pontificating)   ",
    "     (Skipping)     ", "     (Spinning)     ", "      (Crying)      ",
    "     (Laughing)     ", "     (Humming)      ", "    (Whistling)     ",
    "    (Quivering)     ", "    (Muttering)     ", "    (Gibbering)     ",
    "     (Giggling)     ", "     (Moaning)      ", "    (Shrieking)     ",
    "   (Caterwauling)   ",
];

// --- printMonsterInfo — IO.c:4489 ---

/** Render sidebar info for a single creature. Returns y after last line printed. C: `printMonsterInfo` */
export function printMonsterInfo(
    monst: Creature,
    y: number,
    dim: boolean,
    highlight: boolean,
    ctx: SidebarContext,
): number {
    if (y >= ROWS - 1) return ROWS - 1;

    const initialY = y;

    if (y < ROWS - 1) {
        // Blank line
        printString("                    ", 0, y, white, black, ctx.displayBuffer);

        // Get the cell appearance, temporarily removing IS_IN_PATH flag
        const inPath = !!(ctx.pmap[monst.loc.x][monst.loc.y].flags & TileFlag.IS_IN_PATH);
        ctx.pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.IS_IN_PATH;
        const appearance = ctx.getCellAppearance(monst.loc);
        let monstForeColor: Color = { ...appearance.foreColor };
        let monstBackColor: Color = { ...appearance.backColor };
        applyColorBounds(monstForeColor, 0, 100);
        applyColorBounds(monstBackColor, 0, 100);
        if (inPath) {
            ctx.pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.IS_IN_PATH;
        }

        if (dim) {
            applyColorAverage(monstForeColor, black, 50);
            applyColorAverage(monstBackColor, black, 50);
        } else if (highlight) {
            applyColorAugment(monstForeColor, black, 100);
            applyColorAugment(monstBackColor, black, 100);
        }

        plotCharWithColor(appearance.glyph, { windowX: 0, windowY: y }, monstForeColor, monstBackColor, ctx.displayBuffer);
        if (monst.carriedItem) {
            plotCharWithColor(monst.carriedItem.displayChar, { windowX: 1, windowY: y }, itemColor, black, ctx.displayBuffer);
        }
        let monstName = ctx.monsterName(monst, false);
        monstName = monstName.charAt(0).toUpperCase() + monstName.slice(1);

        if (monst === ctx.player) {
            const colorEsc = encodeMessageColor(monstForeColor);
            monstName += colorEsc;
            if (ctx.player.status[StatusEffect.Invisible]) {
                monstName += "(invisible)";
            } else if (ctx.playerInDarkness()) {
                monstName += "(dark)";
            } else if (!(ctx.pmap[ctx.player.loc.x][ctx.player.loc.y].flags & TileFlag.IS_IN_SHADOW)) {
                monstName += "(lit)";
            }
        }

        const buf = `: ${monstName}`;
        printString(buf, monst.carriedItem ? 2 : 1, y++, dim ? gray : white, black, ctx.displayBuffer);
    }

    // Mutation, if any
    if (
        y < ROWS - 1 &&
        monst.mutationIndex >= 0 &&
        (!ctx.player.status[StatusEffect.Hallucinating] || ctx.rogue.playbackOmniscience)
    ) {
        let buf = "                    "; // 20 spaces
        const mutation = ctx.mutationCatalog[monst.mutationIndex];
        const tempColor: Color = { ...mutation.textColor };
        if (dim) {
            applyColorAverage(tempColor, black, 50);
        }
        const colorEsc = encodeMessageColor(tempColor);
        let buf2 = `${colorEsc}(${mutation.title})`;

        const visLen = strLenWithoutEscapes(buf);
        const mutLen = strLenWithoutEscapes(buf2);
        const offset = Math.trunc((visLen - mutLen) / 2);

        // Center the mutation text within the 20-char field
        buf = buf.substring(0, offset) + buf2;
        // Pad to 20+4 chars (4 for color escape)
        while (buf.length < 24) {
            buf += " ";
        }
        buf = buf.substring(0, 24);

        printString(buf, 0, y++, dim ? gray : white, black, ctx.displayBuffer);
    }

    // Health bar
    if (monst.info.maxHP > 1 && !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        let healthBarColor: Color;
        if (monst === ctx.player) {
            healthBarColor = { ...redBar };
            applyColorAverage(healthBarColor, blueBar, Math.min(100, Math.trunc(100 * ctx.player.currentHP / ctx.player.info.maxHP)));
        } else {
            healthBarColor = { ...blueBar };
        }

        const percent = creatureHealthChangePercent(monst);
        let healthLabel: string;
        if (monst.currentHP <= 0) {
            healthLabel = "Dead";
        } else if (percent !== 0) {
            const percentStr = `(${percent > 0 ? "+" : ""}${percent}%)`;
            healthLabel = "       Health       ";
            healthLabel = healthLabel.substring(0, SIDEBAR_WIDTH - percentStr.length) + percentStr;
        } else {
            healthLabel = "Health";
        }

        printProgressBar(0, y++, healthLabel, monst.currentHP, monst.info.maxHP, healthBarColor, dim, ctx.displayBuffer);
    }

    if (monst === ctx.player) {
        // Nutrition bar
        if (ctx.player.status[StatusEffect.Nutrition] > HUNGER_THRESHOLD) {
            printProgressBar(0, y++, "Nutrition", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (ctx.player.status[StatusEffect.Nutrition] > WEAK_THRESHOLD) {
            printProgressBar(0, y++, "Nutrition (Hungry)", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (ctx.player.status[StatusEffect.Nutrition] > FAINT_THRESHOLD) {
            printProgressBar(0, y++, "Nutrition (Weak)", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (ctx.player.status[StatusEffect.Nutrition] > 0) {
            printProgressBar(0, y++, "Nutrition (Faint)", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (y < ROWS - 1) {
            printString("      STARVING      ", 0, y++, badMessageColor, black, ctx.displayBuffer);
        }
    }

    // Status effects
    if (!ctx.player.status[StatusEffect.Hallucinating] || ctx.rogue.playbackOmniscience || monst === ctx.player) {
        for (let i = 0; i < StatusEffect.NumberOfStatusEffects; i++) {
            if (y >= ROWS - 1) break;

            if (i === StatusEffect.Weakened && monst.status[i] > 0) {
                const label = `${ctx.statusEffectCatalog[StatusEffect.Weakened].name}${monst.weaknessAmount}`;
                printProgressBar(0, y++, label, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            } else if (i === StatusEffect.Levitating && monst.status[i] > 0) {
                const label = monst === ctx.player ? "Levitating" : "Flying";
                printProgressBar(0, y++, label, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            } else if (i === StatusEffect.Poisoned && monst.status[i] > 0) {
                const poisonLabel = monst.status[i] * monst.poisonAmount >= monst.currentHP ? "Fatal Poison" : "Poisoned";
                const pLabel = monst.poisonAmount === 1 ? poisonLabel : `${poisonLabel} (x${monst.poisonAmount})`;
                printProgressBar(0, y++, pLabel, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            } else if (ctx.statusEffectCatalog[i].name.length > 0 && monst.status[i] > 0) {
                printProgressBar(0, y++, ctx.statusEffectCatalog[i].name, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            }
        }

        if (monst.targetCorpseLoc.x === monst.loc.x && monst.targetCorpseLoc.y === monst.loc.y) {
            printProgressBar(0, y++, ctx.monsterText[monst.info.monsterID].absorbStatus, monst.corpseAbsorptionCounter, 20, redBar, dim, ctx.displayBuffer);
        }
    }

    // Player stats (str/armor, gold, stealth)
    if (monst === ctx.player) {
        if (y < ROWS - 1) {
            let tempColorEsc = "";
            let grayColorEsc = "";
            if (ctx.player.status[StatusEffect.Weakened]) {
                const tempColor: Color = { ...red };
                if (dim) {
                    applyColorAverage(tempColor, black, 50);
                }
                tempColorEsc = encodeMessageColor(tempColor);
                grayColorEsc = encodeMessageColor(dim ? darkGray : gray);
            }

            let armorBuf: string;
            if (!ctx.rogue.armor || (ctx.rogue.armor.flags & ItemFlag.ITEM_IDENTIFIED) || ctx.rogue.playbackOmniscience) {
                armorBuf = `Str: ${tempColorEsc}${ctx.rogue.strength - ctx.player.weaknessAmount}${grayColorEsc}  Armor: ${ctx.displayedArmorValue()}`;
            } else {
                armorBuf = `Str: ${tempColorEsc}${ctx.rogue.strength - ctx.player.weaknessAmount}${grayColorEsc}  Armor: ${ctx.estimatedArmorValue()}?`;
            }

            printString("                    ", 0, y, white, black, ctx.displayBuffer);
            printString(armorBuf, Math.trunc((SIDEBAR_WIDTH - strLenWithoutEscapes(armorBuf)) / 2), y++, dim ? darkGray : gray, black, ctx.displayBuffer);
        }

        if (y < ROWS - 1 && ctx.rogue.gold) {
            const goldBuf = `Gold: ${ctx.rogue.gold}`;
            printString("                    ", 0, y, white, black, ctx.displayBuffer);
            printString(goldBuf, Math.trunc((SIDEBAR_WIDTH - goldBuf.length) / 2), y++, dim ? darkGray : gray, black, ctx.displayBuffer);
        }

        if (y < ROWS - 1) {
            const percent = Math.trunc((ctx.rogue.stealthRange - 2) * 100 / 28);
            const tempColor: Color = { ...playerInShadowColor };
            applyColorAverage(tempColor, black, percent);
            applyColorAugment(tempColor, playerInLightColor, percent);
            if (dim) {
                applyColorAverage(tempColor, black, 50);
            }
            const stealthColorEsc = encodeMessageColor(tempColor);
            const grayEsc = encodeMessageColor(dim ? darkGray : gray);
            const stealthBuf = `${stealthColorEsc}Stealth range: ${ctx.rogue.stealthRange}${grayEsc}`;
            printString("                    ", 0, y, white, black, ctx.displayBuffer);
            printString(stealthBuf, 1, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
        }
    } else if (y < ROWS - 1) {
        // Monster behavior line
        if (
            monst.wasNegated &&
            monst.newPowerCount === monst.totalPowerCount &&
            (!ctx.player.status[StatusEffect.Hallucinating] || ctx.rogue.playbackOmniscience)
        ) {
            printString("      Negated       ", 0, y++, dim ? darkPink : pink, black, ctx.displayBuffer);
        }

        if (!(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) && y < ROWS - 1) {
            if (ctx.player.status[StatusEffect.Hallucinating] && !ctx.rogue.playbackOmniscience) {
                const randIdx = Math.trunc(Math.random() * 10) % HALLUCINATION_STRINGS.length;
                printString(HALLUCINATION_STRINGS[randIdx], 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
                printString("     (Captive)      ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (
                (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
                !ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
            ) {
                printString("     (Helpless)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Sleeping) {
                printString("     (Sleeping)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Ally) {
                printString("       (Ally)       ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Fleeing) {
                printString("     (Fleeing)      ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Wandering) {
                if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
                    monst.leader &&
                    (monst.leader.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)
                ) {
                    printString("    (Worshiping)    ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
                } else if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
                    monst.leader &&
                    (monst.leader.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
                ) {
                    printString("     (Guarding)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
                } else {
                    printString("    (Wandering)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
                }
            } else if (monst.ticksUntilTurn > Math.max(0, ctx.player.ticksUntilTurn) + ctx.player.movementSpeed) {
                printString("   (Off balance)    ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.TrackingScent) {
                printString("     (Hunting)      ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            }
        }
    }

    // Trailing blank line
    if (y < ROWS - 1) {
        printString("                    ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
    }

    // Highlight gradient
    if (highlight) {
        for (let i = 0; i < SIDEBAR_WIDTH; i++) {
            const highlightStrength = Math.trunc(smoothHiliteGradient(i, SIDEBAR_WIDTH - 1) / 10);
            for (let j = initialY; j < (y === ROWS - 1 ? y : Math.min(y - 1, ROWS - 1)); j++) {
                highlightScreenCell(i, j, white, highlightStrength, ctx.displayBuffer);
            }
        }
    }

    return y;
}

// --- collectSidebarEntities — extracted from refreshSideBar for testability ---

/**
 * Build the ordered entity list for the sidebar. Player first, then directly
 * visible entities, then indirectly visible — all sorted by proximity.
 */
export function collectSidebarEntities(
    focusX: number,
    focusY: number,
    focusedEntityMustGoFirst: boolean,
    ctx: SidebarContext,
): SidebarEntity[] {
    const entities: SidebarEntity[] = [];
    const addedEntity: boolean[][] = Array.from({ length: DCOLS }, () => Array(DROWS).fill(false));
    const px = ctx.player.loc.x;
    const py = ctx.player.loc.y;

    // Player always goes first
    entities.push({ type: EntityDisplayType.Creature, creature: ctx.player, x: px, y: py });
    addedEntity[px][py] = true;
    // Item at the player's location
    const playerItem = ctx.itemAtLoc(ctx.player.loc);
    if (playerItem) {
        entities.push({ type: EntityDisplayType.Item, item: playerItem, x: playerItem.loc.x, y: playerItem.loc.y });
    }

    // Focused entity (if it must go first)
    if (focusedEntityMustGoFirst && focusX >= 0 && focusY >= 0 && !addedEntity[focusX][focusY]) {
        addedEntity[focusX][focusY] = true;

        if (ctx.pmap[focusX][focusY].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
            const monst = ctx.monsterAtLoc({ x: focusX, y: focusY });
            if (monst && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience)) {
                entities.push({ type: EntityDisplayType.Creature, creature: monst, x: focusX, y: focusY });
            }
        } else if (ctx.pmap[focusX][focusY].flags & TileFlag.HAS_ITEM) {
            const item = ctx.itemAtLoc({ x: focusX, y: focusY });
            if (item && ctx.playerCanSeeOrSense(focusX, focusY)) {
                entities.push({ type: EntityDisplayType.Item, item, x: focusX, y: focusY });
            }
        } else if (
            ctx.cellHasTMFlag({ x: focusX, y: focusY }, TerrainMechFlag.TM_LIST_IN_SIDEBAR) &&
            ctx.playerCanSeeOrSense(focusX, focusY)
        ) {
            const layer = ctx.layerWithTMFlag(focusX, focusY, TerrainMechFlag.TM_LIST_IN_SIDEBAR);
            if (layer !== DungeonLayer.NoLayer) {
                const desc = ctx.tileCatalog[ctx.pmap[focusX][focusY].layers[layer]].description;
                entities.push({
                    type: EntityDisplayType.Terrain,
                    terrainDescription: desc,
                    x: focusX,
                    y: focusY,
                });
            }
        }
    }

    // Two passes: direct vision first, then indirect vision
    for (let indirectVision = 0; indirectVision < 2; indirectVision++) {
        // Monsters, sorted by proximity
        let found = true;
        while (found && entities.length * 2 < ROWS) {
            found = false;
            let shortestDist = 10000;
            let closestMonst: Creature | null = null;

            for (const monst of ctx.iterateMonsters()) {
                if (
                    (ctx.canDirectlySeeMonster(monst) || (indirectVision && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience))) &&
                    !addedEntity[monst.loc.x][monst.loc.y] &&
                    !(monst.info.flags & MonsterBehaviorFlag.MONST_NOT_LISTED_IN_SIDEBAR)
                ) {
                    const dist = (px - monst.loc.x) ** 2 + (py - monst.loc.y) ** 2;
                    if (dist < shortestDist) {
                        shortestDist = dist;
                        closestMonst = monst;
                    }
                }
            }
            if (closestMonst) {
                found = true;
                addedEntity[closestMonst.loc.x][closestMonst.loc.y] = true;
                entities.push({
                    type: EntityDisplayType.Creature,
                    creature: closestMonst,
                    x: closestMonst.loc.x,
                    y: closestMonst.loc.y,
                });
            }
        }

        // Items, sorted by proximity
        found = true;
        while (found && entities.length * 2 < ROWS) {
            found = false;
            let shortestDist = 10000;
            let closestItem: Item | null = null;

            for (const item of ctx.floorItems()) {
                if (
                    (ctx.playerCanDirectlySee(item.loc.x, item.loc.y) || (indirectVision && (ctx.playerCanSeeOrSense(item.loc.x, item.loc.y) || ctx.rogue.playbackOmniscience))) &&
                    !addedEntity[item.loc.x][item.loc.y]
                ) {
                    const dist = (px - item.loc.x) ** 2 + (py - item.loc.y) ** 2;
                    if (dist < shortestDist) {
                        shortestDist = dist;
                        closestItem = item;
                    }
                }
            }
            if (closestItem) {
                found = true;
                addedEntity[closestItem.loc.x][closestItem.loc.y] = true;
                entities.push({
                    type: EntityDisplayType.Item,
                    item: closestItem,
                    x: closestItem.loc.x,
                    y: closestItem.loc.y,
                });
            }
        }

        // Terrain, scanning concentric squares from player
        const maxRadius = Math.max(DROWS, DCOLS);
        for (let k = 0; k < maxRadius; k++) {
            if (entities.length >= ROWS - 1) break;

            for (let i = px - k; i <= px + k; i++) {
                // First and last columns need full stepping; middle columns only scan edges
                const step = (i === px - k || i === px + k) ? 1 : 2 * k;
                for (let j = py - k; j <= py + k; j += (step || 1)) {
                    if (entities.length >= ROWS - 1) break;

                    if (
                        coordinatesAreInMap(i, j) &&
                        !addedEntity[i][j] &&
                        ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_LIST_IN_SIDEBAR) &&
                        (ctx.playerCanDirectlySee(i, j) || (indirectVision && (ctx.playerCanSeeOrSense(i, j) || ctx.rogue.playbackOmniscience)))
                    ) {
                        addedEntity[i][j] = true;
                        const layer = ctx.layerWithTMFlag(i, j, TerrainMechFlag.TM_LIST_IN_SIDEBAR);
                        if (layer !== DungeonLayer.NoLayer) {
                            const desc = ctx.tileCatalog[ctx.pmap[i][j].layers[layer]].description;
                            entities.push({
                                type: EntityDisplayType.Terrain,
                                terrainDescription: desc,
                                x: i,
                                y: j,
                            });
                        }
                    }
                }
            }
        }
    }

    return entities;
}

// --- refreshSideBar — IO.c:3695 ---

/**
 * Refresh the sidebar. Lists visible entities by proximity; highlights focused entity.
 * Updates `rogue.sidebarLocationList` so each row maps to its entity location.
 * C: `refreshSideBar`
 */
export function refreshSideBar(
    focusX: number,
    focusY: number,
    focusedEntityMustGoFirst: boolean,
    ctx: SidebarContext,
): void {
    if (ctx.rogue.gameHasEnded || ctx.rogue.playbackFastForward) {
        return;
    }

    if (focusX < 0) {
        focusedEntityMustGoFirst = false;
    }

    // Determine focus entity
    let focusEntity: { x: number; y: number } | null = null;
    if (focusX >= 0) {
        if (ctx.pmap[focusX][focusY].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
            const monst = ctx.monsterAtLoc({ x: focusX, y: focusY });
            if (monst && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience)) {
                focusEntity = { x: focusX, y: focusY };
            }
        }
        if (!focusEntity && (ctx.pmap[focusX][focusY].flags & TileFlag.HAS_ITEM)) {
            const item = ctx.itemAtLoc({ x: focusX, y: focusY });
            if (item && ctx.playerCanSeeOrSense(focusX, focusY)) {
                focusEntity = { x: focusX, y: focusY };
            }
        }
        if (
            !focusEntity &&
            ctx.cellHasTMFlag({ x: focusX, y: focusY }, TerrainMechFlag.TM_LIST_IN_SIDEBAR) &&
            ctx.playerCanSeeOrSense(focusX, focusY)
        ) {
            focusEntity = { x: focusX, y: focusY };
        }
    }

    let printY = 0;

    // Initialize sidebar location list
    for (let i = 0; i < ROWS * 2; i++) {
        ctx.rogue.sidebarLocationList[i] = { x: -1, y: -1 };
    }

    // Playback header
    if (ctx.rogue.playbackMode) {
        printString("   -- PLAYBACK --   ", 0, printY++, white, black, ctx.displayBuffer);
        if (ctx.rogue.howManyTurns > 0) {
            const turnLabel = `Turn ${ctx.rogue.playerTurnNumber}/${ctx.rogue.howManyTurns}`;
            printProgressBar(0, printY++, turnLabel, ctx.rogue.playerTurnNumber, ctx.rogue.howManyTurns, darkPurple, false, ctx.displayBuffer);
        }
        if (ctx.rogue.playbackOOS) {
            printString("    [OUT OF SYNC]   ", 0, printY++, badMessageColor, black, ctx.displayBuffer);
        } else if (ctx.rogue.playbackPaused) {
            printString("      [PAUSED]      ", 0, printY++, gray, black, ctx.displayBuffer);
        }
        printString("                    ", 0, printY++, white, black, ctx.displayBuffer);
    }

    // Collect entities
    const entities = collectSidebarEntities(focusX, focusY, focusedEntityMustGoFirst, ctx);

    // Render entities
    let gotFocusedEntityOnScreen = focusX < 0;

    for (let i = 0; i < entities.length && printY < ROWS - 1; i++) {
        const entity = entities[i];
        const oldPrintY = printY;
        const isFocused = focusEntity !== null && entity.x === focusX && entity.y === focusY;
        const isDimmed = focusEntity !== null && !isFocused;

        if (entity.type === EntityDisplayType.Creature && entity.creature) {
            printY = printMonsterInfo(entity.creature, printY, isDimmed, isFocused, ctx);
        } else if (entity.type === EntityDisplayType.Item && entity.item) {
            printY = printItemInfo(entity.item, printY, isDimmed, isFocused, ctx);
        } else if (entity.type === EntityDisplayType.Terrain && entity.terrainDescription) {
            printY = printTerrainInfo(entity.x, entity.y, printY, entity.terrainDescription, isDimmed, isFocused, ctx);
        }

        if (isFocused && printY < ROWS) {
            gotFocusedEntityOnScreen = true;
        }

        // Map sidebar rows to entity location
        for (let j = oldPrintY; j < printY; j++) {
            ctx.rogue.sidebarLocationList[j] = { x: entity.x, y: entity.y };
        }
    }

    if (gotFocusedEntityOnScreen) {
        // Clear remaining rows
        for (let i = printY; i < ROWS - 1; i++) {
            printString("                    ", 0, i, white, black, ctx.displayBuffer);
        }
        // Depth footer
        const depthPadding = ctx.rogue.depthLevel < 10 ? " " : "";
        const depthBuf = `  -- Depth: ${ctx.rogue.depthLevel} --${depthPadding}   `;
        printString(depthBuf, 0, ROWS - 1, white, black, ctx.displayBuffer);
    } else if (!focusedEntityMustGoFirst) {
        // Failed to get the focused entity on screen. Retry with focus first.
        refreshSideBar(focusX, focusY, true, ctx);
    }
}

// --- printMonsterDetails — IO.c:5035 ---

/** Display a detailed text panel for a monster. C: `printMonsterDetails` */
export function printMonsterDetails(monst: Creature, ctx: SidebarContext): void {
    const textBuf = ctx.monsterDetails(monst);
    ctx.printTextBox(textBuf, monst.loc.x, 0, 0, white, black);
}
