/*
 *  monster-bolt-ai.test.ts — Tests for monsterHasBoltEffect and monsterCanShootWebs
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    monsterHasBoltEffect,
    monsterCanShootWebs,
} from "../../src/monsters/monster-bolt-ai.js";
import type { Creature, Bolt, FloorTileType, DungeonFeature } from "../../src/types/types.js";
import { BoltEffect } from "../../src/types/enums.js";
import { TerrainFlag } from "../../src/types/flags.js";
import { white } from "../../src/globals/colors.js";

// =============================================================================
// Minimal test helpers
// =============================================================================

function makeMonster(bolts: number[]): Creature {
    const boltArray = new Array(20).fill(0);
    bolts.forEach((b, i) => { boltArray[i] = b; });
    return {
        info: {
            monsterID: 1,
            flags: 0,
            abilityFlags: 0,
            movementSpeed: 100,
            attackSpeed: 100,
            maxHP: 10,
            damage: { lowerBound: 1, upperBound: 2, clumpFactor: 1 },
            defense: 10,
            accuracy: 80,
            turnsBetweenRegen: 5000,
            bolts: boltArray,
            displayChar: "r",
            foreColor: white,
        },
        currentHP: 10,
        movementSpeed: 100,
        attackSpeed: 100,
        mutationIndex: -1,
        status: new Array(50).fill(0),
        bookkeepingFlags: 0,
        creatureState: 0,
        loc: { x: 5, y: 5 },
    } as unknown as Creature;
}

function makeBolt(boltEffect: BoltEffect, pathDF = 0): Bolt {
    return {
        boltEffect,
        pathDF,
        flags: 0,
        forbiddenMonsterFlags: 0,
        targetDF: 0,
        description: "fires",
    } as unknown as Bolt;
}

function makeTileCatalog(entangles: boolean): FloorTileType[] {
    const catalog = new Array(10).fill(null).map(() => ({ flags: 0 })) as FloorTileType[];
    if (entangles) {
        catalog[3] = { flags: TerrainFlag.T_ENTANGLES } as unknown as FloorTileType;
    }
    return catalog;
}

function makeDungeonFeatureCatalog(tileIndex: number): DungeonFeature[] {
    const catalog = new Array(10).fill(null).map(() => ({ tile: 0 })) as DungeonFeature[];
    catalog[5] = { tile: tileIndex } as unknown as DungeonFeature;
    return catalog;
}

// =============================================================================
// monsterHasBoltEffect
// =============================================================================

describe("monsterHasBoltEffect", () => {
    it("returns 0 when monster has no bolts", () => {
        const monst = makeMonster([]);
        const boltCatalog: Bolt[] = [];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(0);
    });

    it("returns bolt type when monster has matching bolt effect", () => {
        const monst = makeMonster([2]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),   // index 0
            makeBolt(BoltEffect.Attack), // index 1
            makeBolt(BoltEffect.Blinking), // index 2 — match
        ];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(2);
    });

    it("returns 0 when bolt effect does not match", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),    // index 0
            makeBolt(BoltEffect.Attack),  // index 1
        ];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(0);
    });

    it("returns first matching bolt type when multiple bolts present", () => {
        const monst = makeMonster([1, 2, 3]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Haste),    // index 1
            makeBolt(BoltEffect.Blinking), // index 2 — first match
            makeBolt(BoltEffect.Blinking), // index 3 — second match (not returned)
        ];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(2);
    });

    it("stops scanning at first zero bolt entry", () => {
        // bolts array is [2, 0, 1] — scan stops at index 1
        const monst = makeMonster([2, 0, 1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Attack),   // index 1 — never reached
            makeBolt(BoltEffect.Blinking), // index 2
        ];
        // Should find bolt 2 (Blinking) at position 0 of the bolts array
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(2);
        // But if we search for Attack (index 1), scan stops at zero before reaching it
        expect(monsterHasBoltEffect(monst, BoltEffect.Attack, boltCatalog)).toBe(0);
    });
});

// =============================================================================
// monsterCanShootWebs
// =============================================================================

describe("monsterCanShootWebs", () => {
    it("returns false when monster has no bolts", () => {
        const monst = makeMonster([]);
        expect(monsterCanShootWebs(monst, [], [], [])).toBe(false);
    });

    it("returns false when bolt has no pathDF", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Attack, 0), // pathDF = 0 → no terrain feature
        ];
        expect(monsterCanShootWebs(monst, boltCatalog, [], [])).toBe(false);
    });

    it("returns true when bolt pathDF tile has T_ENTANGLES", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.None, 5), // pathDF = 5
        ];
        const tileCatalog = makeTileCatalog(true);  // tile 3 has T_ENTANGLES
        const dfCatalog = makeDungeonFeatureCatalog(3); // df[5].tile = 3
        expect(monsterCanShootWebs(monst, boltCatalog, tileCatalog, dfCatalog)).toBe(true);
    });

    it("returns false when bolt pathDF tile does not entangle", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Damage, 5), // pathDF = 5
        ];
        const tileCatalog = makeTileCatalog(false); // no T_ENTANGLES
        const dfCatalog = makeDungeonFeatureCatalog(3);
        expect(monsterCanShootWebs(monst, boltCatalog, tileCatalog, dfCatalog)).toBe(false);
    });
});
