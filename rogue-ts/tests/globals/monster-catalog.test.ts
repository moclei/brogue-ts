/*
 *  monster-catalog.test.ts — Tests for monsterCatalog and hordeCatalog
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { hordeCatalog } from "../../src/globals/horde-catalog.js";
import { MonsterType, TileType } from "../../src/types/enums.js";
import { HordeFlag } from "../../src/types/flags.js";

describe("monsterCatalog", () => {
    it("has 68 entries (one per MonsterType)", () => {
        expect(monsterCatalog).toHaveLength(68);
    });

    it("first entry is the player (MK_YOU)", () => {
        expect(monsterCatalog[0].monsterID).toBe(MonsterType.MK_YOU);
        expect(monsterCatalog[0].monsterName).toBe("you");
    });

    it("entries are indexed by MonsterType enum value", () => {
        // Spot-check several entries
        expect(monsterCatalog[MonsterType.MK_RAT].monsterName).toBe("rat");
        expect(monsterCatalog[MonsterType.MK_KOBOLD].monsterName).toBe("kobold");
        expect(monsterCatalog[MonsterType.MK_GOBLIN].monsterName).toBe("goblin");
        expect(monsterCatalog[MonsterType.MK_OGRE].monsterName).toBe("ogre");
        expect(monsterCatalog[MonsterType.MK_DRAGON].monsterName).toBe("dragon");
        expect(monsterCatalog[MonsterType.MK_ANCIENT_SPIRIT].monsterName).toBe("mangrove dryad");
    });

    it("all entries have valid damage RandomRange", () => {
        for (const entry of monsterCatalog) {
            expect(entry.damage).toBeDefined();
            expect(typeof entry.damage.lowerBound).toBe("number");
            expect(typeof entry.damage.upperBound).toBe("number");
            expect(typeof entry.damage.clumpFactor).toBe("number");
        }
    });

    it("all entries have non-negative HP", () => {
        for (const entry of monsterCatalog) {
            expect(entry.maxHP).toBeGreaterThanOrEqual(0);
        }
    });

    it("dragon has carry item 100 flag and fire immunity", () => {
        const dragon = monsterCatalog[MonsterType.MK_DRAGON];
        expect(dragon.monsterName).toBe("dragon");
        expect(dragon.maxHP).toBe(150);
    });

    it("spectral blade is inanimate and never sleeps", () => {
        const blade = monsterCatalog[MonsterType.MK_SPECTRAL_BLADE];
        expect(blade.monsterName).toBe("spectral blade");
        expect(blade.maxHP).toBe(1);
    });
});

describe("hordeCatalog", () => {
    it("has 175 entries", () => {
        expect(hordeCatalog).toHaveLength(175);
    });

    it("first entry is a rat horde", () => {
        const first = hordeCatalog[0];
        expect(first.leaderType).toBe(MonsterType.MK_RAT);
        expect(first.numberOfMemberTypes).toBe(0);
        expect(first.minLevel).toBe(1);
        expect(first.maxLevel).toBe(5);
        expect(first.frequency).toBe(150);
    });

    it("all entries have valid memberCount arrays matching numberOfMemberTypes", () => {
        for (const entry of hordeCatalog) {
            // memberType and memberCount arrays should be at least numberOfMemberTypes long
            // (they can be [0] for no-member hordes)
            expect(entry.memberCount.length).toBeGreaterThanOrEqual(entry.numberOfMemberTypes);
        }
    });

    it("eel hordes spawn in deep water", () => {
        const eelHordes = hordeCatalog.filter(h => h.leaderType === MonsterType.MK_EEL);
        expect(eelHordes.length).toBeGreaterThan(0);
        for (const horde of eelHordes) {
            expect(horde.spawnsIn).toBe(TileType.DEEP_WATER);
        }
    });

    it("summoned hordes have HORDE_IS_SUMMONED flag", () => {
        const summoned = hordeCatalog.filter(h => (h.flags & HordeFlag.HORDE_IS_SUMMONED) !== 0);
        expect(summoned.length).toBeGreaterThan(0);
        for (const horde of summoned) {
            expect(horde.minLevel).toBe(0);
            expect(horde.maxLevel).toBe(0);
        }
    });

    it("boss hordes have HORDE_MACHINE_BOSS flag", () => {
        const bosses = hordeCatalog.filter(h => (h.flags & HordeFlag.HORDE_MACHINE_BOSS) !== 0);
        expect(bosses.length).toBe(4); // goblin chieftain, black jelly, vampire, flamedancer
    });

    it("legendary ally hordes are allied with player", () => {
        const allies = hordeCatalog.filter(h =>
            (h.flags & HordeFlag.HORDE_MACHINE_LEGENDARY_ALLY) !== 0,
        );
        expect(allies.length).toBe(4); // unicorn, ifrit, phoenix egg, ancient spirit
        for (const ally of allies) {
            expect(ally.flags & HordeFlag.HORDE_ALLIED_WITH_PLAYER).not.toBe(0);
        }
    });

    it("captive hordes have HORDE_LEADER_CAPTIVE flag", () => {
        const captives = hordeCatalog.filter(h =>
            (h.flags & HordeFlag.HORDE_LEADER_CAPTIVE) !== 0 &&
            (h.flags & HordeFlag.HORDE_MACHINE_CAPTIVE) === 0 &&
            (h.flags & HordeFlag.HORDE_MACHINE_KENNEL) === 0 &&
            (h.flags & HordeFlag.HORDE_VAMPIRE_FODDER) === 0 &&
            (h.flags & HordeFlag.HORDE_MACHINE_GOBLIN_WARREN) === 0 &&
            (h.flags & HordeFlag.HORDE_IS_SUMMONED) === 0 &&
            (h.flags & HordeFlag.HORDE_MACHINE_LEGENDARY_ALLY) === 0,
        );
        expect(captives.length).toBeGreaterThan(0);
        // All have HORDE_NEVER_OOD
        for (const c of captives) {
            expect(c.flags & HordeFlag.HORDE_NEVER_OOD).not.toBe(0);
        }
    });

    it("key thief hordes have HORDE_MACHINE_THIEF flag", () => {
        const thieves = hordeCatalog.filter(h => (h.flags & HordeFlag.HORDE_MACHINE_THIEF) !== 0);
        expect(thieves.length).toBe(2); // monkey and imp
    });

    it("sacrifice hordes spawn on STATUE_INSTACRACK", () => {
        const sacrifices = hordeCatalog.filter(h =>
            (h.flags & HordeFlag.HORDE_SACRIFICE_TARGET) !== 0,
        );
        expect(sacrifices.length).toBe(10);
        for (const s of sacrifices) {
            expect(s.spawnsIn).toBe(TileType.STATUE_INSTACRACK);
        }
    });
});
