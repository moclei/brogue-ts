/*
 *  io/cursor-move.ts — Targeting cursor movement and auto-target helpers
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Items.c
 *  Functions: itemMagicPolarityIsKnown (5181, private),
 *             canAutoTargetMonster (5197, private),
 *             nextTargetAfter (5281),
 *             moveCursor (5372)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Creature, Item, Pos, Bolt, RogueEvent, ButtonState,
    ScreenDisplayBuffer, SavedDisplayBuffer,
} from "../types/types.js";
import {
    EventType, AutoTargetMode, BoltEffect, ItemCategory,
    StatusEffect, WeaponKind, PotionKind,
} from "../types/enums.js";
import {
    BoltFlag, MonsterAbilityFlag, MonsterBehaviorFlag,
    MonsterBookkeepingFlag, TileFlag, TerrainMechFlag, ItemFlag,
} from "../types/flags.js";
import {
    DCOLS, DROWS, ROWS,
    LEFT_KEY, RIGHT_KEY, UP_KEY, DOWN_KEY,
    LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9, NUMPAD_0,
    TAB_KEY, SHIFT_TAB_KEY, RETURN_KEY, ESCAPE_KEY, ACKNOWLEDGE_KEY,
} from "../types/constants.js";
import { RNG } from "../types/enums.js";
import { getTableForCategory, itemMagicPolarity, itemIsThrowingWeapon } from "../items/item-generation.js";
import { stripShiftFromMovementKeystroke } from "./input-keystrokes.js";

// =============================================================================
// itemMagicPolarityIsKnown — Items.c:5181 (private helper)
// =============================================================================

/**
 * Returns true if the player knows the item has the given magic polarity.
 * The polarity is known when the item is detected/identified, OR when the
 * item's kind is identified or has its polarity revealed in the table.
 *
 * C: static boolean itemMagicPolarityIsKnown(const item *theItem, int magicPolarity)
 *    — Items.c:5181
 */
function itemMagicPolarityIsKnown(theItem: Item, magicPolarity: number): boolean {
    const table = getTableForCategory(theItem.category);
    if (
        (theItem.flags & (ItemFlag.ITEM_MAGIC_DETECTED | ItemFlag.ITEM_IDENTIFIED)) ||
        (table && (table[theItem.kind].identified || table[theItem.kind].magicPolarityRevealed))
    ) {
        return itemMagicPolarity(theItem) === magicPolarity;
    }
    return false;
}

// =============================================================================
// canAutoTargetMonster — Items.c:5197 (private helper)
// =============================================================================

/** Dependencies for canAutoTargetMonster (subset of targeting context). */
export interface AutoTargetContext {
    player: Creature;
    rogue: { depthLevel: number };
    boltCatalog: readonly Bolt[];
    monstersAreTeammates(a: Creature, b: Creature): boolean;
    canSeeMonster(monst: Creature): boolean;
    openPathBetween(from: Pos, to: Pos): boolean;
    distanceBetween(a: Pos, b: Pos): number;
    /** wandDominate(monst.currentHP, monst.info.maxHP) */
    wandDominate(currentHP: number, maxHP: number): number;
    negationWillAffectMonster(monst: Creature, isBolt: boolean): boolean;
}

/**
 * Returns true if a monster is a valid auto-target when using a staff/wand
 * or throwing something.
 *
 * C: static boolean canAutoTargetMonster(const creature *monst,
 *        const item *theItem, enum autoTargetMode targetingMode)
 *    — Items.c:5197
 */
export function canAutoTargetMonster(
    monst: Creature,
    theItem: Item | null,
    targetMode: AutoTargetMode,
    ctx: AutoTargetContext,
): boolean {
    const isThrow = targetMode === AutoTargetMode.Throw;
    const isUse   = targetMode === AutoTargetMode.UseStaffOrWand;

    if (
        !monst || !theItem ||
        (!isThrow && !isUse) ||
        monst.depth !== ctx.rogue.depthLevel ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) ||
        (isUse && !(theItem.category & (ItemCategory.STAFF | ItemCategory.WAND))) ||
        (isThrow && !(theItem.category & (ItemCategory.POTION | ItemCategory.WEAPON))) ||
        (isThrow && (theItem.category & ItemCategory.WEAPON) && !itemIsThrowingWeapon(theItem)) ||
        (isThrow && (theItem.category & ItemCategory.WEAPON) &&
            (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) ||
        (isThrow && (theItem.category & ItemCategory.POTION) &&
            itemMagicPolarityIsKnown(theItem, 1 /* MAGIC_POLARITY_BENEVOLENT */)) ||
        !ctx.canSeeMonster(monst) ||
        !ctx.openPathBetween(ctx.player.loc, monst.loc) ||
        (ctx.player.status[StatusEffect.Hallucinating] &&
            !ctx.player.status[StatusEffect.Telepathic] &&
            !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)))
    ) {
        return false;
    }

    const isAlly  = ctx.monstersAreTeammates(ctx.player, monst) ||
                    !!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE);
    const isEnemy = !isAlly;
    const table   = getTableForCategory(theItem.category);
    const itemKindIsKnown = table ? table[theItem.kind].identified : false;

    if (isThrow) {
        if (theItem.category & ItemCategory.WEAPON) {
            if (
                (theItem.kind === WeaponKind.IncendiaryDart &&
                    monst.status[StatusEffect.ImmuneToFire]) ||
                (theItem.kind !== WeaponKind.IncendiaryDart &&
                    (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS))
            ) {
                return false;
            }
        }
        if (itemKindIsKnown && (theItem.category & ItemCategory.POTION)) {
            if (
                (theItem.kind === PotionKind.Incineration &&
                    monst.status[StatusEffect.ImmuneToFire]) ||
                ((monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
                    (theItem.kind === PotionKind.Confusion || theItem.kind === PotionKind.Poison))
            ) {
                return false;
            }
        }
        return isEnemy;
    }

    // Using a staff or wand
    if (isEnemy && (monst.info.abilityFlags & MonsterAbilityFlag.MA_REFLECT_100)) {
        return false;
    }

    const bolt = ctx.boltCatalog[table![theItem.kind].power];
    const magicPolarityKnownBenevolent = itemMagicPolarityIsKnown(theItem, 1);
    const magicPolarityKnownMalevolent = itemMagicPolarityIsKnown(theItem, -1);
    const magicPolarityKnown = magicPolarityKnownBenevolent || magicPolarityKnownMalevolent;

    if (itemKindIsKnown) {
        if (
            (bolt.forbiddenMonsterFlags & monst.info.flags) ||
            (isEnemy && bolt.boltEffect === BoltEffect.Domination &&
                ctx.wandDominate(monst.currentHP, monst.info.maxHP) <= 0) ||
            (isEnemy && bolt.boltEffect === BoltEffect.Beckoning &&
                ctx.distanceBetween(ctx.player.loc, monst.loc) <= 1) ||
            (isEnemy && bolt.boltEffect === BoltEffect.Damage &&
                (bolt.flags & BoltFlag.BF_FIERY) && monst.status[StatusEffect.ImmuneToFire]) ||
            (isAlly && bolt.boltEffect === BoltEffect.Healing &&
                !(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) &&
                monst.currentHP >= monst.info.maxHP)
        ) {
            return false;
        } else if (isEnemy && bolt.boltEffect === BoltEffect.Negation) {
            return ctx.negationWillAffectMonster(monst, true);
        } else if (
            isEnemy && bolt.boltEffect === BoltEffect.Tunneling &&
            (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
        ) {
            return true;
        } else if (
            (isAlly && (bolt.flags & BoltFlag.BF_TARGET_ALLIES)) ||
            (isEnemy && (bolt.flags & BoltFlag.BF_TARGET_ENEMIES))
        ) {
            return true;
        }
    } else if (magicPolarityKnown) {
        if (
            (isEnemy && magicPolarityKnownBenevolent) ||
            (isAlly && magicPolarityKnownMalevolent)
        ) {
            return true;
        }
    } else if (isEnemy) {
        // Both kind and polarity unknown — target by default
        return true;
    }

    return false;
}

// =============================================================================
// NextTargetContext
// =============================================================================

/** Dependencies for nextTargetAfter. */
export interface NextTargetContext extends AutoTargetContext {
    rogue: AutoTargetContext["rogue"] & { sidebarLocationList: Pos[] };
    isPosInMap(loc: Pos): boolean;
    posEq(a: Pos, b: Pos): boolean;
    monsterAtLoc(loc: Pos): Creature | null;
    itemAtLoc(loc: Pos): Item | null;
}

// =============================================================================
// nextTargetAfter — Items.c:5281
// =============================================================================

/**
 * Advance the targeting cursor to the next valid auto-target in the sidebar
 * entity list, skipping past `targetLoc`.  Writes the new location into
 * `returnLoc.value` and returns true on success.
 *
 * C: boolean nextTargetAfter(const item *theItem, pos *returnLoc, pos targetLoc,
 *        enum autoTargetMode targetMode, boolean reverseDirection)
 *    — Items.c:5281
 *
 * @param theItem         Staff/wand/thrown weapon being aimed (may be null for explore mode).
 * @param returnLoc       Output: receives the new target position.
 * @param targetLoc       Currently selected target position.
 * @param targetMode      Auto-target mode.
 * @param reverseDirection Cycle backward through the list.
 * @param ctx             DI context.
 * @returns               true if a new target was found.
 */
export function nextTargetAfter(
    theItem: Item | null,
    returnLoc: { value: Pos },
    targetLoc: Pos,
    targetMode: AutoTargetMode | number,
    reverseDirection: boolean,
    ctx: NextTargetContext,
): boolean {
    if (targetMode === AutoTargetMode.None) {
        return false;
    }

    let selectedIndex = 0;
    const deduped: Pos[] = [];

    for (let i = 0; i < ROWS; i++) {
        const loc = ctx.rogue.sidebarLocationList[i];
        if (!ctx.isPosInMap(loc)) continue;
        if (deduped.length > 0 && ctx.posEq(deduped[deduped.length - 1], loc)) continue;
        if (ctx.posEq(loc, targetLoc)) {
            selectedIndex = deduped.length;
        }
        deduped.push(loc);
    }

    const count = deduped.length;
    if (count === 0) return false;

    const start = reverseDirection ? count - 1 : 0;
    const end   = reverseDirection ? -1 : count;
    const step  = reverseDirection ? -1 : 1;

    for (let i = start; reverseDirection ? i > end : i < end; i += step) {
        const n = ((selectedIndex + i) % count + count) % count;
        const newLoc = deduped[n];
        if (
            (!ctx.posEq(newLoc, ctx.player.loc) || !!ctx.itemAtLoc(newLoc)) &&
            !ctx.posEq(newLoc, targetLoc) &&
            (targetMode === AutoTargetMode.Explore ||
                ctx.openPathBetween(ctx.player.loc, newLoc))
        ) {
            const monst = ctx.monsterAtLoc(newLoc);
            if (
                (monst && canAutoTargetMonster(monst, theItem, targetMode as AutoTargetMode, ctx)) ||
                targetMode === AutoTargetMode.Explore
            ) {
                returnLoc.value = newLoc;
                return true;
            }
        }
    }
    return false;
}

// =============================================================================
// MoveCursorContext
// =============================================================================

/** Dependencies for moveCursor. */
export interface MoveCursorContext {
    rogue: { cursorLoc: Pos; RNG: number; sidebarLocationList: Pos[] };

    /** Synchronous event poll (no-op/fake outside browser game loop). */
    nextKeyOrMouseEvent(textInput: boolean, colorsDance: boolean): RogueEvent;

    // Display buffers (used for the button-draw path when state != null)
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    overlayDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    restoreDisplayBuffer(rbuf: SavedDisplayBuffer): void;

    /** Draw buttons into the display buffer. */
    drawButtonsInState(state: ButtonState, dbuf: ScreenDisplayBuffer): void;
    /** Process one event against the button state; returns chosen index or -1. */
    processButtonInput(state: ButtonState, event: RogueEvent): Promise<number>;

    refreshSideBar(x: number, y: number, justClearing: boolean): void;
    pmapFlagsAt(loc: Pos): number;
    canSeeMonster(monst: Creature): boolean;
    monsterAtLoc(loc: Pos): Creature | null;
    playerCanSeeOrSense(x: number, y: number): boolean;
    cellHasTMFlag(loc: Pos, flag: number): boolean;

    coordinatesAreInMap(x: number, y: number): boolean;
    isPosInMap(loc: Pos): boolean;
    mapToWindowX(x: number): number;
    windowToMapX(x: number): number;
    windowToMapY(y: number): number;
}

// =============================================================================
// moveCursor — Items.c:5372
// =============================================================================

/**
 * Process one input cycle for cursor/targeting movement.
 * Reads one event, updates `rogue.cursorLoc` and the output refs, then
 * returns `!cursorMovementCommand` — i.e. true when the event should be
 * re-dispatched by the caller (non-movement events), false when the cursor
 * moved (caller should stay in the targeting loop).
 *
 * Async because `processButtonInput` is async (and in the real browser game
 * this function will await a real input event via waitForEvent).
 *
 * C: boolean moveCursor(boolean *targetConfirmed, boolean *canceled,
 *        boolean *tabKey, pos *targetLoc, rogueEvent *event,
 *        buttonState *state, boolean colorsDance,
 *        boolean keysMoveCursor, boolean targetCanLeaveMap)
 *    — Items.c:5372
 */
export async function moveCursor(
    targetConfirmed: { value: boolean },
    canceled: { value: boolean },
    tabKey: { value: boolean },
    targetLoc: { value: Pos },
    theEvent: { value: RogueEvent },
    state: ButtonState | null,
    colorsDance: boolean,
    keysMoveCursor: boolean,
    targetCanLeaveMap: boolean,
    ctx: MoveCursorContext,
): Promise<boolean> {
    ctx.rogue.cursorLoc = { ...targetLoc.value };
    targetConfirmed.value = false;
    canceled.value = false;
    tabKey.value = false;
    let sidebarHighlighted = false;

    let event: RogueEvent = {
        eventType: EventType.EventError,
        param1: 0, param2: 0, controlKey: false, shiftKey: false,
    };
    let again: boolean;
    let cursorMovementCommand = false;
    let movementKeystroke = false;

    do {
        again = false;
        cursorMovementCommand = false;
        movementKeystroke = false;

        const oldRNG = ctx.rogue.RNG;
        ctx.rogue.RNG = RNG.Cosmetic;

        // Draw buttons (if any) into a temp buffer; get event; process input.
        if (state !== null) {
            const dbuf = ctx.createScreenDisplayBuffer();
            ctx.clearDisplayBuffer(dbuf);
            ctx.drawButtonsInState(state, dbuf);
            const rbuf = ctx.saveDisplayBuffer();
            ctx.overlayDisplayBuffer(dbuf);

            event = ctx.nextKeyOrMouseEvent(false, colorsDance);
            const buttonInput = await ctx.processButtonInput(state, event);
            if (buttonInput !== -1) {
                state.buttonDepressed = state.buttonFocused = -1;
            }

            ctx.restoreDisplayBuffer(rbuf);
        } else {
            event = ctx.nextKeyOrMouseEvent(false, colorsDance);
        }
        ctx.rogue.RNG = oldRNG;

        const mapLeft = ctx.mapToWindowX(0);
        if (event.eventType === EventType.MouseUp || event.eventType === EventType.MouseEnteredCell) {
            const mx = event.param1;
            const my = event.param2;
            if (
                mx >= 0 && mx < mapLeft &&
                my >= 0 && my < ROWS - 1 &&
                ctx.isPosInMap(ctx.rogue.sidebarLocationList[my])
            ) {
                // Click/hover on sidebar entity
                ctx.rogue.cursorLoc = { ...ctx.rogue.sidebarLocationList[my] };
                sidebarHighlighted = true;
                cursorMovementCommand = true;
                ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                if (event.eventType === EventType.MouseUp) {
                    targetConfirmed.value = true;
                }
            } else if (
                ctx.coordinatesAreInMap(ctx.windowToMapX(mx), ctx.windowToMapY(my)) ||
                (targetCanLeaveMap && event.eventType !== EventType.MouseUp)
            ) {
                if (
                    event.eventType === EventType.MouseUp &&
                    !event.shiftKey &&
                    (event.controlKey ||
                        (ctx.rogue.cursorLoc.x === ctx.windowToMapX(mx) &&
                         ctx.rogue.cursorLoc.y === ctx.windowToMapY(my)))
                ) {
                    targetConfirmed.value = true;
                }
                ctx.rogue.cursorLoc.x = ctx.windowToMapX(mx);
                ctx.rogue.cursorLoc.y = ctx.windowToMapY(my);
                cursorMovementCommand = true;
            } else {
                cursorMovementCommand = false;
                // C: again=true so the loop re-fetches a fresh event.  In the TS
                // wrapper, nextKeyOrMouseEvent() returns the *same* pre-fetched event
                // on every call, so re-running the loop would process it again
                // indefinitely.  When state=null (no button panel) the wrapper will
                // call waitForEvent() for the next real event, so we must exit now.
                again = state !== null && event.eventType !== EventType.MouseUp;
            }
        } else if (event.eventType === EventType.Keystroke) {
            let keystroke = event.param1;
            const moveIncrement = (event.controlKey || event.shiftKey) ? 5 : 1;
            keystroke = stripShiftFromMovementKeystroke(keystroke);
            switch (keystroke) {
                case LEFT_ARROW: case LEFT_KEY: case NUMPAD_4:
                    if (keysMoveCursor) ctx.rogue.cursorLoc.x -= moveIncrement;
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case RIGHT_ARROW: case RIGHT_KEY: case NUMPAD_6:
                    if (keysMoveCursor) ctx.rogue.cursorLoc.x += moveIncrement;
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case UP_ARROW: case UP_KEY: case NUMPAD_8:
                    if (keysMoveCursor) ctx.rogue.cursorLoc.y -= moveIncrement;
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case DOWN_ARROW: case DOWN_KEY: case NUMPAD_2:
                    if (keysMoveCursor) ctx.rogue.cursorLoc.y += moveIncrement;
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case UPLEFT_KEY: case NUMPAD_7:
                    if (keysMoveCursor) { ctx.rogue.cursorLoc.x -= moveIncrement; ctx.rogue.cursorLoc.y -= moveIncrement; }
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case UPRIGHT_KEY: case NUMPAD_9:
                    if (keysMoveCursor) { ctx.rogue.cursorLoc.x += moveIncrement; ctx.rogue.cursorLoc.y -= moveIncrement; }
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case DOWNLEFT_KEY: case NUMPAD_1:
                    if (keysMoveCursor) { ctx.rogue.cursorLoc.x -= moveIncrement; ctx.rogue.cursorLoc.y += moveIncrement; }
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case DOWNRIGHT_KEY: case NUMPAD_3:
                    if (keysMoveCursor) { ctx.rogue.cursorLoc.x += moveIncrement; ctx.rogue.cursorLoc.y += moveIncrement; }
                    cursorMovementCommand = movementKeystroke = keysMoveCursor;
                    break;
                case TAB_KEY: case SHIFT_TAB_KEY: case NUMPAD_0:
                    tabKey.value = true;
                    break;
                case RETURN_KEY:
                    targetConfirmed.value = true;
                    break;
                case ESCAPE_KEY: case ACKNOWLEDGE_KEY:
                    canceled.value = true;
                    break;
                default:
                    break;
            }
        } else if (event.eventType === EventType.RightMouseUp) {
            // do nothing
        } else {
            // Unknown/fake event (e.g. EventError from stub nextKeyOrMouseEvent).
            // Do not set `again` — exit gracefully rather than looping forever.
        }

        // De-highlight sidebar if cursor is no longer on a visible entity.
        if (sidebarHighlighted) {
            const flags = ctx.pmapFlagsAt(ctx.rogue.cursorLoc);
            const monst = ctx.monsterAtLoc(ctx.rogue.cursorLoc);
            if (
                (!(flags & (TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER)) ||
                    !monst || !ctx.canSeeMonster(monst)) &&
                (!(flags & TileFlag.HAS_ITEM) ||
                    !ctx.playerCanSeeOrSense(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y)) &&
                (!ctx.cellHasTMFlag(ctx.rogue.cursorLoc, TerrainMechFlag.TM_LIST_IN_SIDEBAR) ||
                    !ctx.playerCanSeeOrSense(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y))
            ) {
                ctx.refreshSideBar(-1, -1, false);
                sidebarHighlighted = false;
            }
        }

        // Clamp cursor to map bounds (or ±1 outside when targetCanLeaveMap).
        if (targetCanLeaveMap && !movementKeystroke) {
            ctx.rogue.cursorLoc.x = Math.max(-1, Math.min(DCOLS, ctx.rogue.cursorLoc.x));
            ctx.rogue.cursorLoc.y = Math.max(-1, Math.min(DROWS, ctx.rogue.cursorLoc.y));
        } else {
            ctx.rogue.cursorLoc.x = Math.max(0, Math.min(DCOLS - 1, ctx.rogue.cursorLoc.x));
            ctx.rogue.cursorLoc.y = Math.max(0, Math.min(DROWS - 1, ctx.rogue.cursorLoc.y));
        }
    } while (again && !cursorMovementCommand);

    theEvent.value = event;

    if (sidebarHighlighted) {
        ctx.refreshSideBar(-1, -1, false);
    }

    targetLoc.value = { ...ctx.rogue.cursorLoc };
    return !cursorMovementCommand;
}
