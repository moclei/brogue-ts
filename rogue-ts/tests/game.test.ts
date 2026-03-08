/*
 *  game.test.ts — Tests for game/ module functions
 *  brogue-ts
 *
 *  Phase 3b NEEDS-VERIFICATION: setPlayerDisplayChar
 *  Ported from: src/brogue/Monsters.c:409–415
 */

import { describe, it, expect } from "vitest";
import { setPlayerDisplayChar } from "../src/game/game-init.js";
import { createCreature } from "../src/monsters/monster-creation.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, GameMode, DisplayGlyph } from "../src/types/enums.js";
import type { Creature } from "../src/types/types.js";

function makePlayer(): Creature {
    const c = createCreature();
    const cat = monsterCatalog[MonsterType.MK_YOU];
    c.info = { ...cat, damage: { ...cat.damage }, foreColor: { ...cat.foreColor }, bolts: [...cat.bolts] };
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

// =============================================================================
// setPlayerDisplayChar — Monsters.c:409
// =============================================================================

describe("setPlayerDisplayChar", () => {
    it("sets G_DEMON in easy mode", () => {
        const player = makePlayer();
        setPlayerDisplayChar(player, GameMode.Easy);
        expect(player.info.displayChar).toBe(DisplayGlyph.G_DEMON);
    });

    it("sets G_PLAYER in normal mode", () => {
        const player = makePlayer();
        setPlayerDisplayChar(player, GameMode.Normal);
        expect(player.info.displayChar).toBe(DisplayGlyph.G_PLAYER);
    });

    it("sets G_PLAYER for any non-easy mode", () => {
        const player = makePlayer();
        setPlayerDisplayChar(player, GameMode.Seed);
        expect(player.info.displayChar).toBe(DisplayGlyph.G_PLAYER);
    });
});
