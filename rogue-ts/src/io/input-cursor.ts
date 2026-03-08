/*
 *  io/input-cursor.ts — Cursor/path mode: mainInputLoop
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/io/io-input.ts (lines 1484–1875)
 *  Source C: src/brogue/IO.c
 *  Functions: mainInputLoop
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueButton, ButtonState, Pos, RogueEvent, SavedDisplayBuffer } from "../types/types.js";
import { EventType, Direction } from "../types/enums.js";
import { RNG as RNGEnum } from "../types/enums.js";
import {
    ACKNOWLEDGE_KEY, ASCEND_KEY, DESCEND_KEY,
} from "../types/constants.js";
import { white } from "../globals/colors.js";
import type { InputContext } from "./input-keystrokes.js";
import { executeEvent } from "./input-dispatch.js";
import {
    initializeMenuButtons, actionMenu, executeMouseClick,
} from "./input-mouse.js";

const MAX_MENU_BUTTON_COUNT = 5;

// =============================================================================
// mainInputLoop — IO.c:537
// =============================================================================

/**
 * The main cursor/path input loop — draws cursor and path, gets events from
 * moveCursor, dispatches confirmed actions.
 *
 * Entered when the player presses Return (showCursor) to place a cursor on
 * the map and target a location for travel.
 */
export async function mainInputLoop(ctx: InputContext): Promise<void> {
    let oldTargetLoc: Pos = { x: 0, y: 0 };
    let steps: number;
    const path: Pos[] = new Array(1000);

    let canceled = false;
    ctx.rogue.cursorMode = false;
    steps = 0;

    ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;

    const buttons: BrogueButton[] = [];
    for (let i = 0; i < MAX_MENU_BUTTON_COUNT; i++) {
        buttons.push(ctx.initializeButton());
    }
    const state: ButtonState = {
        buttonFocused: -1, buttonDepressed: -1, buttonChosen: -1,
        buttonCount: 0, buttons: [], winX: 0, winY: 0, winWidth: 0, winHeight: 0,
    };
    initializeMenuButtons(ctx, state, buttons);

    let playingBack = ctx.rogue.playbackMode;
    ctx.rogue.playbackMode = false;

    const costMap = ctx.allocGrid();
    const playerPathingMap = ctx.allocGrid();
    const cursorSnapMap = ctx.allocGrid();

    ctx.rogue.cursorLoc = { x: -1, y: -1 };

    while (!ctx.rogue.gameHasEnded && (!playingBack || !canceled)) {
        const oldRNG = ctx.rogue.RNG;
        ctx.rogue.RNG = RNGEnum.Cosmetic;

        let focusedOnMonster = false;
        let focusedOnItem = false;
        let focusedOnTerrain = false;
        steps = 0;
        ctx.clearCursorPath();

        const originLoc: Pos = { ...ctx.player.loc };

        if (playingBack && ctx.rogue.cursorMode) {
            ctx.temporaryMessage("Examine what? (<hjklyubn>, mouse, or <tab>)", 0);
        }

        if (
            !playingBack &&
            ctx.posEq(ctx.player.loc, ctx.rogue.cursorLoc) &&
            ctx.posEq(oldTargetLoc, ctx.rogue.cursorLoc)
        ) {
            ctx.rogue.cursorMode = false;
            ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;
            ctx.rogue.cursorLoc = { x: -1, y: -1 };
        }

        oldTargetLoc = { ...ctx.rogue.cursorLoc };

        ctx.populateCreatureCostMap(costMap, ctx.player);
        ctx.fillGrid(playerPathingMap, 30000);
        playerPathingMap[ctx.player.loc.x][ctx.player.loc.y] = 0;
        ctx.dijkstraScan(playerPathingMap, costMap, true);
        ctx.processSnapMap(cursorSnapMap);

        let targetConfirmed: { value: boolean } = { value: false };
        let canceledRef: { value: boolean } = { value: false };
        let tabKey: { value: boolean } = { value: false };
        let doEvent: boolean;
        let textDisplayed: boolean;
        let theEvent: RogueEvent = {
            eventType: EventType.EventError,
            param1: 0, param2: 0, controlKey: false, shiftKey: false,
        };
        let rbuf: SavedDisplayBuffer | undefined;

        do {
            textDisplayed = false;

            if (ctx.isPosInMap(oldTargetLoc)) {
                ctx.refreshDungeonCell(oldTargetLoc);
            }
            if (!playingBack) {
                if (ctx.isPosInMap(oldTargetLoc)) {
                    ctx.hilitePath(path, steps, true);
                }
                if (ctx.isPosInMap(ctx.rogue.cursorLoc)) {
                    let pathDestination: Pos;
                    if (
                        cursorSnapMap[ctx.rogue.cursorLoc.x]?.[ctx.rogue.cursorLoc.y] >= 0 &&
                        cursorSnapMap[ctx.rogue.cursorLoc.x][ctx.rogue.cursorLoc.y] < 30000
                    ) {
                        pathDestination = { ...ctx.rogue.cursorLoc };
                    } else {
                        pathDestination = ctx.getClosestValidLocationOnMap(
                            cursorSnapMap, ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y,
                        );
                    }

                    ctx.fillGrid(playerPathingMap, 30000);
                    playerPathingMap[pathDestination.x][pathDestination.y] = 0;
                    const backupCost = costMap[pathDestination.x][pathDestination.y];
                    costMap[pathDestination.x][pathDestination.y] = 1;
                    ctx.dijkstraScan(playerPathingMap, costMap, true);
                    costMap[pathDestination.x][pathDestination.y] = backupCost;
                    steps = ctx.getPlayerPathOnMap(path, playerPathingMap, ctx.player.loc);

                    if (steps >= 0) path[steps] = pathDestination;
                    steps++;

                    if (
                        playerPathingMap[ctx.player.loc.x][ctx.player.loc.y] !== 1 ||
                        !ctx.posEq(pathDestination, ctx.rogue.cursorLoc)
                    ) {
                        ctx.hilitePath(path, steps, false);
                    }
                }
            }

            if (ctx.isPosInMap(ctx.rogue.cursorLoc)) {
                ctx.hiliteCell(
                    ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, white,
                    steps <= 0 ||
                        ctx.posEq(path[steps - 1], ctx.rogue.cursorLoc) ||
                        (!playingBack && ctx.distanceBetween(ctx.player.loc, ctx.rogue.cursorLoc) <= 1)
                        ? 100 : 25,
                    true,
                );

                oldTargetLoc = { ...ctx.rogue.cursorLoc };

                const monst = ctx.monsterAtLoc(ctx.rogue.cursorLoc);
                const theItem = ctx.itemAtLoc(ctx.rogue.cursorLoc);

                if (monst != null && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience)) {
                    ctx.rogue.playbackMode = playingBack;
                    ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                    ctx.rogue.playbackMode = false;
                    focusedOnMonster = true;
                    if (
                        monst !== ctx.player &&
                        (!ctx.player.status[ctx.STATUS_HALLUCINATING] ||
                            ctx.rogue.playbackOmniscience ||
                            ctx.player.status[ctx.STATUS_TELEPATHIC])
                    ) {
                        rbuf = ctx.saveDisplayBuffer();
                        ctx.printMonsterDetails(monst);
                        textDisplayed = true;
                    }
                } else if (
                    theItem != null &&
                    ctx.playerCanSeeOrSense(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y)
                ) {
                    ctx.rogue.playbackMode = playingBack;
                    ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                    ctx.rogue.playbackMode = false;
                    focusedOnItem = true;
                    if (!ctx.player.status[ctx.STATUS_HALLUCINATING] || ctx.rogue.playbackOmniscience) {
                        rbuf = ctx.saveDisplayBuffer();
                        ctx.printFloorItemDetails(theItem);
                        textDisplayed = true;
                    }
                } else if (
                    ctx.cellHasTMFlag(ctx.rogue.cursorLoc, ctx.TM_LIST_IN_SIDEBAR) &&
                    ctx.playerCanSeeOrSense(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y)
                ) {
                    ctx.rogue.playbackMode = playingBack;
                    ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                    ctx.rogue.playbackMode = false;
                    focusedOnTerrain = true;
                }

                ctx.printLocationDescription(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y);
            }

            ctx.rogue.playbackMode = playingBack;
            const cursorLocRef = { value: { ...ctx.rogue.cursorLoc } };
            const theEventRef = { value: theEvent };
            doEvent = await ctx.moveCursor(
                targetConfirmed, canceledRef, tabKey,
                cursorLocRef, theEventRef, state,
                !textDisplayed, ctx.rogue.cursorMode, true,
            );
            ctx.rogue.cursorLoc = cursorLocRef.value;
            theEvent = theEventRef.value;
            ctx.rogue.playbackMode = false;

            if (state.buttonChosen === 3) {
                const buttonInput = await actionMenu(ctx, buttons[3].x - 4, playingBack);
                if (buttonInput === -1) {
                    doEvent = false;
                } else {
                    theEvent = {
                        eventType: EventType.Keystroke,
                        param1: buttonInput, param2: 0,
                        shiftKey: false, controlKey: false,
                    };
                    doEvent = true;
                }
            } else if (state.buttonChosen > -1) {
                theEvent = {
                    eventType: EventType.Keystroke,
                    param1: buttons[state.buttonChosen].hotkey[0], param2: 0,
                    shiftKey: false, controlKey: false,
                };
            }
            state.buttonChosen = -1;
            canceled = canceledRef.value;

            if (playingBack) {
                if (canceled) {
                    ctx.rogue.cursorMode = false;
                    ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;
                }
                if (theEvent.eventType === EventType.Keystroke && theEvent.param1 === ACKNOWLEDGE_KEY) {
                    canceled = true;
                } else {
                    canceled = false;
                }
            }

            if (focusedOnMonster || focusedOnItem || focusedOnTerrain) {
                focusedOnMonster = false;
                focusedOnItem = false;
                focusedOnTerrain = false;
                if (textDisplayed && rbuf) {
                    ctx.restoreDisplayBuffer(rbuf);
                }
                ctx.rogue.playbackMode = playingBack;
                ctx.refreshSideBar(-1, -1, false);
                ctx.rogue.playbackMode = false;
            }

            if (tabKey.value && !playingBack) {
                const newLoc = { value: { x: 0, y: 0 } };
                if (ctx.nextTargetAfter(null, newLoc, ctx.rogue.cursorLoc, ctx.AUTOTARGET_MODE_EXPLORE, theEvent.shiftKey)) {
                    ctx.rogue.cursorLoc = newLoc.value;
                }
            }

            if (
                theEvent.eventType === EventType.Keystroke &&
                ((theEvent.param1 === ASCEND_KEY &&
                    ctx.rogue.cursorLoc.x === ctx.rogue.upLoc.x &&
                    ctx.rogue.cursorLoc.y === ctx.rogue.upLoc.y) ||
                    (theEvent.param1 === DESCEND_KEY &&
                        ctx.rogue.cursorLoc.x === ctx.rogue.downLoc.x &&
                        ctx.rogue.cursorLoc.y === ctx.rogue.downLoc.y))
            ) {
                targetConfirmed.value = true;
                doEvent = false;
            }
        } while (!targetConfirmed.value && !canceled && !doEvent && !ctx.rogue.gameHasEnded);

        if (ctx.isPosInMap(oldTargetLoc)) {
            ctx.refreshDungeonCell(oldTargetLoc);
        }

        ctx.rogue.RNG = oldRNG;

        if (canceled && !playingBack) {
            ctx.hideCursor();
            ctx.confirmMessages();
        } else if (targetConfirmed.value && !playingBack && ctx.isPosInMap(ctx.rogue.cursorLoc)) {
            if (theEvent.eventType === EventType.MouseUp && theEvent.controlKey && steps > 1) {
                // Control-click: move one step along path
                let dir: number;
                for (dir = 0; dir < Direction.DirectionCount; dir++) {
                    const nx = ctx.player.loc.x + ctx.nbDirs[dir][0];
                    const ny = ctx.player.loc.y + ctx.nbDirs[dir][1];
                    if (path[0] && nx === path[0].x && ny === path[0].y) break;
                }
                if (dir < Direction.DirectionCount) ctx.playerMoves(dir);
            } else if (ctx.D_WORMHOLING) {
                await ctx.travel(ctx.rogue.cursorLoc, true);
            } else {
                ctx.confirmMessages();
                if (ctx.posEq(originLoc, ctx.rogue.cursorLoc)) {
                    ctx.confirmMessages();
                } else if (
                    Math.abs(ctx.player.loc.x - ctx.rogue.cursorLoc.x) +
                        Math.abs(ctx.player.loc.y - ctx.rogue.cursorLoc.y) === 1 ||
                    (ctx.distanceBetween(ctx.player.loc, ctx.rogue.cursorLoc) === 1 &&
                        (!ctx.diagonalBlocked(
                            ctx.player.loc.x, ctx.player.loc.y,
                            ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y,
                            !ctx.rogue.playbackOmniscience,
                        ) ||
                            ((ctx.pmapFlagsAt(ctx.rogue.cursorLoc) & ctx.HAS_MONSTER) !== 0 &&
                                ctx.monsterAtLoc(ctx.rogue.cursorLoc) != null &&
                                (ctx.monsterAtLoc(ctx.rogue.cursorLoc)!.info.flags & ctx.MONST_ATTACKABLE_THRU_WALLS) !== 0) ||
                            ((ctx.terrainFlags(ctx.rogue.cursorLoc) & ctx.T_OBSTRUCTS_PASSABILITY) !== 0 &&
                                (ctx.terrainMechFlags(ctx.rogue.cursorLoc) & ctx.TM_PROMOTES_ON_PLAYER_ENTRY) !== 0)))
                ) {
                    let dir: number;
                    for (dir = 0; dir < Direction.DirectionCount; dir++) {
                        if (
                            ctx.player.loc.x + ctx.nbDirs[dir][0] === ctx.rogue.cursorLoc.x &&
                            ctx.player.loc.y + ctx.nbDirs[dir][1] === ctx.rogue.cursorLoc.y
                        ) break;
                    }
                    if (dir < Direction.DirectionCount) ctx.playerMoves(dir);
                } else if (steps) {
                    await ctx.travelRoute(path, steps);
                }
            }
        } else if (doEvent) {
            if (playingBack) {
                ctx.rogue.playbackMode = true;
                ctx.executePlaybackInput(theEvent);
                playingBack = ctx.rogue.playbackMode;
                ctx.rogue.playbackMode = false;
            } else {
                await executeEvent(ctx, theEvent, executeMouseClick, (ax, pb) => actionMenu(ctx, ax, pb));
                if (ctx.rogue.playbackMode) {
                    playingBack = true;
                    ctx.rogue.playbackMode = false;
                    ctx.confirmMessages();
                    break;
                }
            }
        }
    }

    ctx.rogue.playbackMode = playingBack;
    ctx.refreshSideBar(-1, -1, false);
    ctx.freeGrid(costMap);
    ctx.freeGrid(playerPathingMap);
    ctx.freeGrid(cursorSnapMap);
}
