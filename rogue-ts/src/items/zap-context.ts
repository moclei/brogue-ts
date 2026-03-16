/*
 *  items/zap-context.ts — Shared context interfaces for the bolt/zap system
 *  brogue-ts
 *
 *  ZapContext  — domain + game-state dependencies for updateBolt, detonateBolt, zap
 *  ZapRenderContext — rendering stubs injected into zap (all no-ops at this phase)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Color, Item, Bolt, MonsterClass, Pcell } from "../types/types.js";
import type { MonsterType, LightType, DungeonFeatureType, DisplayGlyph } from "../types/enums.js";

// =============================================================================
// ZapRenderContext — rendering stubs
// =============================================================================

/**
 * All visual/animation side-effects of zap. Every method is a no-op stub
 * at this phase; the real implementations belong to port-v2-platform.
 *
 * Based on the plan: `refreshSideBar`, `displayCombatText`, `refreshDungeonCell`,
 * `getCellAppearance`, `backUpLighting`, `restoreLighting`, `demoteVisibility`,
 * `updateFieldOfViewDisplay`, `paintLight`, `updateVision`, `updateLighting`,
 * `hiliteCell`, `pauseAnimation`.
 */
export interface ZapRenderContext {
    refreshSideBar(): void;
    displayCombatText(): void;
    refreshDungeonCell(loc: Pos): void;
    /** Save current lighting state. */
    backUpLighting(): void;
    /** Restore lighting from last backup. */
    restoreLighting(): void;
    demoteVisibility(): void;
    updateFieldOfViewDisplay(dancingTerrain: boolean, refreshDisplay: boolean): void;
    /** Paint one dynamic light source at the given map position. */
    paintLight(lightIndex: number, x: number, y: number): void;
    updateVision(full: boolean): void;
    updateLighting(): void;
    hiliteCell(x: number, y: number, color: Color, strength: number, saveBuf: boolean): void;
    /**
     * Pause the animation for `delay` ms. Returns true if fast-forward is active.
     * Async because it waits for the event queue.
     */
    pauseAnimation(delay: number, behavior: number): Promise<boolean>;
    /** Return the display appearance of a cell. */
    getCellAppearance(loc: Pos): { char: DisplayGlyph; foreColor: Color; backColor: Color };
    /** Draw a character with the given colors at the window position. */
    plotCharWithColor(theChar: DisplayGlyph, loc: Pos, foreColor: Color, backColor: Color): void;
    /** Retrieve a per-cell color multiplier from dynamic lighting. */
    colorMultiplierFromDungeonLight(x: number, y: number): Color;
}

// =============================================================================
// ZapContext — domain dependencies
// =============================================================================

/**
 * All domain dependencies required by updateBolt, detonateBolt, and zap.
 * Stubs for unimplemented functions are marked with a phase comment.
 */
export interface ZapContext {
    // ── Rendering (all no-ops at this phase) ──
    render: ZapRenderContext;

    // ── State ──
    pmap: Pcell[][];
    player: Creature;
    rogue: {
        armor: Item | null;
        strength: number;
        weaknessAmount: number;
        scentTurnNumber: number;
        playbackFastForward: boolean;
        playbackOmniscience: boolean;
    };
    boltCatalog: readonly Bolt[];
    monsterClassCatalog: readonly MonsterClass[];

    // ── Creature queries ──
    monsterAtLoc(pos: Pos): Creature | null;
    canSeeMonster(monst: Creature): boolean;
    playerCanSee(x: number, y: number): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;

    // ── Display helpers ──
    monsterName(monst: Creature, includeArticle: boolean): string;
    message(text: string, flags: number): void;
    combatMessage(text: string, color?: Color | null): void;
    messageColorFromVictim(monst: Creature): Color | null;
    tileText(x: number, y: number): string;

    // ── Combat ──
    attack(attacker: Creature, defender: Creature, defenderInSight: boolean): void;
    inflictDamage(
        attacker: Creature | null,
        defender: Creature,
        damage: number,
        flashColor: Color | null,
        ignoresProtection: boolean,
    ): boolean;
    killCreature(monst: Creature, administrativeDeath: boolean): void;
    moralAttack(attacker: Creature, defender: Creature): void;
    splitMonster(monst: Creature, attacker: Creature): void;
    handlePaladinFeat(monst: Creature): void;
    gameOver(message: string, addLuck: boolean): void;

    // ── Effects ──
    haste(monst: Creature, turns: number): void;
    slow(monst: Creature, duration: number): void;
    imbueInvisibility(monst: Creature, turns: number): boolean;
    /** Wraps wandDominate(monst.currentHP, monst.info.maxHP). */
    wandDominate(monst: Creature): number;
    becomeAllyWith(monst: Creature): void;
    negate(monst: Creature): boolean;
    empowerMonster(monst: Creature): void;
    addPoison(monst: Creature, turnsPerPoison: number, poisonAmount: number): void;
    heal(monst: Creature, amount: number, healsAboveMax: boolean): void;
    /** STUB — Phase 4b */
    cloneMonster(monst: Creature, bookkeep: boolean, adjustLevel: boolean): Creature | null;
    flashMonster(monst: Creature, color: Color | null, timeFactor: number): void;
    wakeUp(monst: Creature): void;
    exposeCreatureToFire(monst: Creature): void;
    exposeTileToFire(x: number, y: number, byCreature: boolean): boolean;
    exposeTileToElectricity(x: number, y: number): boolean;
    createFlare(x: number, y: number, lightType: LightType): void;

    // ── Bolt-travel effects ──
    tunnelize(x: number, y: number): boolean;
    freeCaptivesEmbeddedAt(x: number, y: number): void;
    spawnDungeonFeature(
        x: number,
        y: number,
        dfType: DungeonFeatureType,
        refreshCell: boolean,
        abortIfBlocking: boolean,
        probabilityDecrement?: number,
    ): void;

    // ── Teleport / blink ──
    teleport(monst: Creature, targetPos: Pos, safe: boolean): void;
    disentangle(caster: Creature): void;
    applyInstantTileEffectsToCreature(monst: Creature): void;
    pickUpItemAt(loc: Pos): void;
    checkForMissingKeys(x: number, y: number): void;
    /** Returns the alternative position, or null if none found. */
    findAlternativeHomeFor(monst: Creature): Pos | null;
    autoIdentify(theItem: Item): void;

    // ── Beckoning ──
    /** STUB — Phase 5 */
    beckonMonster(monst: Creature, x: number, y: number): void;

    // ── Polymorph ──
    polymorph(monst: Creature): boolean;

    // ── Conjuration (BE_CONJURATION) ──
    setUpWaypoints(): void;
    generateMonster(kind: MonsterType, itemPossible: boolean, mutationPossible: boolean): Creature;
    getQualifyingPathLocNear(loc: Pos, avoidTerrain: number, avoidFlags: number): Pos;
    fadeInMonster(monst: Creature): void;

    // ── RNG ──
    randPercent(pct: number): boolean;
    randRange(lo: number, hi: number): number;
}
