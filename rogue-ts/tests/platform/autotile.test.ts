/*
 *  platform/autotile.test.ts — Unit tests for autotile bitmask computation
 *  Port V2 — rogue-ts
 */

import { describe, it, expect } from "vitest";
import { TileType } from "../../src/types/enums.js";
import {
    AUTOTILE_VARIANT_COUNT,
    AUTOTILE_OFFSETS,
    VARIANT_CANONICAL_MASKS,
    BITMASK_TO_VARIANT,
    computeAdjacencyMask,
    getConnectionGroupInfo,
} from "../../src/platform/autotile.js";

// =============================================================================
// Helpers
// =============================================================================

/** Build a mock accessor from a sparse map of `"x,y"` → TileType. */
function mockAccessor(
    cells: Record<string, TileType>,
): (nx: number, ny: number) => TileType | undefined {
    return (nx, ny) => cells[`${nx},${ny}`];
}

/** Build a Uint8Array where listed TileTypes are members (non-zero). */
function memberSet(...types: TileType[]): Uint8Array {
    const arr = new Uint8Array(TileType.NUMBER_TILETYPES);
    for (const t of types) arr[t] = 1;
    return arr;
}

// =============================================================================
// computeAdjacencyMask
// =============================================================================

describe("computeAdjacencyMask", () => {
    const wallMembers = memberSet(TileType.GRANITE, TileType.WALL, TileType.DOOR);

    it("returns 0 for an isolated cell with oobConnects=false", () => {
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, () => undefined);
        expect(mask).toBe(0);
    });

    it("returns 255 when all 8 neighbors are members", () => {
        const cells: Record<string, TileType> = {};
        for (const [dx, dy] of AUTOTILE_OFFSETS) {
            cells[`${5 + dx},${5 + dy}`] = TileType.WALL;
        }
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells));
        expect(mask).toBe(255);
    });

    it("sets only the N bit when only the north neighbor is a member", () => {
        const cells = { "5,4": TileType.WALL as TileType };
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells));
        expect(mask).toBe(1); // bit 0 = N
    });

    it("computes an L-shaped wall pattern correctly", () => {
        // Wall to the N, E, and NE of (5,5)
        const cells: Record<string, TileType> = {
            "5,4": TileType.WALL,  // N
            "6,4": TileType.WALL,  // NE
            "6,5": TileType.WALL,  // E
        };
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells));
        // N=1, NE=2, E=4 → 7
        expect(mask).toBe(7);
    });

    it("includes DOOR as a wall group member", () => {
        const cells = { "5,4": TileType.DOOR as TileType };
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells));
        expect(mask).toBe(1);
    });

    it("ignores non-member TileTypes", () => {
        const cells = { "5,4": TileType.FLOOR as TileType };
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells));
        expect(mask).toBe(0);
    });

    it("sets correct bits for S and W neighbors", () => {
        const cells: Record<string, TileType> = {
            "5,6": TileType.GRANITE, // S
            "4,5": TileType.GRANITE, // W
        };
        const mask = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells));
        // S = bit 4 = 16, W = bit 6 = 64 → 80
        expect(mask).toBe(80);
    });
});

// =============================================================================
// OOB behavior
// =============================================================================

describe("OOB behavior", () => {
    const members = memberSet(TileType.WALL);

    it("oobConnects=true sets bits for undefined (OOB) neighbors", () => {
        const mask = computeAdjacencyMask(0, 0, members, true, () => undefined);
        expect(mask).toBe(255);
    });

    it("oobConnects=false clears bits for undefined (OOB) neighbors", () => {
        const mask = computeAdjacencyMask(0, 0, members, false, () => undefined);
        expect(mask).toBe(0);
    });

    it("mixes OOB and in-bounds neighbors correctly", () => {
        // Only the E neighbor exists and is a member; all others OOB
        const accessor = (nx: number, ny: number): TileType | undefined => {
            if (nx === 6 && ny === 5) return TileType.WALL;
            return undefined;
        };
        // oobConnects=true: all undefined bits set + E bit set = 255
        expect(computeAdjacencyMask(5, 5, members, true, accessor)).toBe(255);
        // oobConnects=false: only E bit set = 4
        expect(computeAdjacencyMask(5, 5, members, false, accessor)).toBe(4);
    });
});

// =============================================================================
// Connection group membership
// =============================================================================

describe("Connection group membership", () => {
    it("WALL group includes doors (DOOR, OPEN_DOOR, LOCKED_DOOR)", () => {
        for (const tt of [TileType.DOOR, TileType.OPEN_DOOR, TileType.LOCKED_DOOR]) {
            const info = getConnectionGroupInfo(tt);
            expect(info).toBeDefined();
            expect(info!.group).toBe("WALL");
        }
    });

    it("WALL group includes GRANITE and structural wall types", () => {
        for (const tt of [
            TileType.GRANITE, TileType.WALL, TileType.SECRET_DOOR,
            TileType.TORCH_WALL, TileType.CRYSTAL_WALL,
            TileType.PORTCULLIS_CLOSED, TileType.WOODEN_BARRICADE,
        ]) {
            const info = getConnectionGroupInfo(tt);
            expect(info).toBeDefined();
            expect(info!.group).toBe("WALL");
        }
    });

    it("WALL group has oobConnects=true", () => {
        const info = getConnectionGroupInfo(TileType.GRANITE);
        expect(info!.oobConnects).toBe(true);
    });

    it("WATER group includes deep and shallow water", () => {
        for (const tt of [TileType.DEEP_WATER, TileType.SHALLOW_WATER]) {
            const info = getConnectionGroupInfo(tt);
            expect(info).toBeDefined();
            expect(info!.group).toBe("WATER");
        }
    });

    it("WATER group has oobConnects=false", () => {
        const info = getConnectionGroupInfo(TileType.DEEP_WATER);
        expect(info!.oobConnects).toBe(false);
    });

    it("FLOOR group does not include WALL types", () => {
        for (const tt of [TileType.WALL, TileType.GRANITE, TileType.DOOR]) {
            const info = getConnectionGroupInfo(tt);
            expect(info!.group).not.toBe("FLOOR");
        }
    });

    it("FLOOR group includes basic floor types", () => {
        for (const tt of [TileType.FLOOR, TileType.CARPET, TileType.MARBLE_FLOOR]) {
            const info = getConnectionGroupInfo(tt);
            expect(info).toBeDefined();
            expect(info!.group).toBe("FLOOR");
        }
    });

    it("LAVA group members share the same members Uint8Array", () => {
        const lava = getConnectionGroupInfo(TileType.LAVA);
        const brim = getConnectionGroupInfo(TileType.ACTIVE_BRIMSTONE);
        expect(lava!.members).toBe(brim!.members);
    });

    it("all 7 groups are represented", () => {
        const groups = new Set<string>();
        for (let tt = 0; tt < TileType.NUMBER_TILETYPES; tt++) {
            const info = getConnectionGroupInfo(tt as TileType);
            if (info) groups.add(info.group);
        }
        expect(groups.size).toBe(7);
        expect([...groups].sort()).toEqual(
            ["CHASM", "FLOOR", "ICE", "LAVA", "MUD", "WALL", "WATER"],
        );
    });
});

// =============================================================================
// getConnectionGroupInfo
// =============================================================================

describe("getConnectionGroupInfo", () => {
    it("returns correct group for connectable types", () => {
        expect(getConnectionGroupInfo(TileType.GRANITE)!.group).toBe("WALL");
        expect(getConnectionGroupInfo(TileType.DEEP_WATER)!.group).toBe("WATER");
        expect(getConnectionGroupInfo(TileType.LAVA)!.group).toBe("LAVA");
        expect(getConnectionGroupInfo(TileType.CHASM)!.group).toBe("CHASM");
        expect(getConnectionGroupInfo(TileType.FLOOR)!.group).toBe("FLOOR");
        expect(getConnectionGroupInfo(TileType.ICE_DEEP)!.group).toBe("ICE");
        expect(getConnectionGroupInfo(TileType.MUD)!.group).toBe("MUD");
    });

    it("returns undefined for non-connectable types", () => {
        expect(getConnectionGroupInfo(TileType.DOWN_STAIRS)).toBeUndefined();
        expect(getConnectionGroupInfo(TileType.UP_STAIRS)).toBeUndefined();
        expect(getConnectionGroupInfo(TileType.TRAP_DOOR)).toBeUndefined();
        expect(getConnectionGroupInfo(TileType.GAS_TRAP_POISON)).toBeUndefined();
        expect(getConnectionGroupInfo(TileType.ALTAR_INERT)).toBeUndefined();
        expect(getConnectionGroupInfo(TileType.NOTHING)).toBeUndefined();
    });

    it("returns correct dungeonLayer per group", () => {
        expect(getConnectionGroupInfo(TileType.WALL)!.dungeonLayer).toBe(0);     // Dungeon
        expect(getConnectionGroupInfo(TileType.FLOOR)!.dungeonLayer).toBe(0);    // Dungeon
        expect(getConnectionGroupInfo(TileType.CHASM)!.dungeonLayer).toBe(0);    // Dungeon
        expect(getConnectionGroupInfo(TileType.DEEP_WATER)!.dungeonLayer).toBe(1); // Liquid
        expect(getConnectionGroupInfo(TileType.LAVA)!.dungeonLayer).toBe(1);     // Liquid
        expect(getConnectionGroupInfo(TileType.ICE_DEEP)!.dungeonLayer).toBe(1); // Liquid
        expect(getConnectionGroupInfo(TileType.MUD)!.dungeonLayer).toBe(1);      // Liquid
    });
});

// =============================================================================
// VARIANT_CANONICAL_MASKS
// =============================================================================

describe("VARIANT_CANONICAL_MASKS", () => {
    it("has exactly 47 entries", () => {
        expect(VARIANT_CANONICAL_MASKS.length).toBe(AUTOTILE_VARIANT_COUNT);
    });

    it("values are sorted in ascending order", () => {
        for (let i = 1; i < VARIANT_CANONICAL_MASKS.length; i++) {
            expect(VARIANT_CANONICAL_MASKS[i]).toBeGreaterThan(VARIANT_CANONICAL_MASKS[i - 1]);
        }
    });

    it("all values are in the range 0–255", () => {
        for (const v of VARIANT_CANONICAL_MASKS) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(255);
        }
    });

    it("first entry is 0 (isolated) and last entry is 255 (fully surrounded)", () => {
        expect(VARIANT_CANONICAL_MASKS[0]).toBe(0);
        expect(VARIANT_CANONICAL_MASKS[46]).toBe(255);
    });
});

// =============================================================================
// Variant index stability — verification test
// =============================================================================

describe("Variant index stability", () => {
    it("independently computed canonical masks match the hardcoded constant", () => {
        // Independent corner-clearing implementation
        function clearCorners(mask: number): number {
            let m = mask;
            // NE (bit 1): requires N (bit 0) AND E (bit 2)
            if (!(m & 0x01) || !(m & 0x04)) m &= ~0x02;
            // SE (bit 3): requires S (bit 4) AND E (bit 2)
            if (!(m & 0x10) || !(m & 0x04)) m &= ~0x08;
            // SW (bit 5): requires S (bit 4) AND W (bit 6)
            if (!(m & 0x10) || !(m & 0x40)) m &= ~0x20;
            // NW (bit 7): requires N (bit 0) AND W (bit 6)
            if (!(m & 0x01) || !(m & 0x40)) m &= ~0x80;
            return m;
        }

        const unique = new Set<number>();
        for (let raw = 0; raw < 256; raw++) {
            unique.add(clearCorners(raw));
        }
        const sorted = [...unique].sort((a, b) => a - b);

        expect(sorted.length).toBe(47);
        expect(sorted).toEqual([...VARIANT_CANONICAL_MASKS]);
    });
});

// =============================================================================
// Corner clearing
// =============================================================================

describe("Corner clearing via BITMASK_TO_VARIANT", () => {
    it("NE diagonal is irrelevant when N is missing", () => {
        // raw: E + NE = 0b00000110 = 6, canonical clears NE → 0b00000100 = 4
        const withNE = BITMASK_TO_VARIANT[6];     // E + NE (no N)
        const withoutNE = BITMASK_TO_VARIANT[4];   // E only
        expect(withNE).toBe(withoutNE);
    });

    it("NE diagonal is irrelevant when E is missing", () => {
        // raw: N + NE = 0b00000011 = 3, canonical clears NE → 0b00000001 = 1
        const withNE = BITMASK_TO_VARIANT[3];     // N + NE (no E)
        const withoutNE = BITMASK_TO_VARIANT[1];   // N only
        expect(withNE).toBe(withoutNE);
    });

    it("NE diagonal matters when both N and E are set", () => {
        // N + E = 5 (no NE), N + NE + E = 7 (with NE)
        const without = BITMASK_TO_VARIANT[5]; // N + E
        const with_ = BITMASK_TO_VARIANT[7];   // N + NE + E
        expect(without).not.toBe(with_);
    });

    it("SE diagonal is cleared when S is missing", () => {
        expect(BITMASK_TO_VARIANT[0x0C]).toBe(BITMASK_TO_VARIANT[0x04]); // E+SE → E
    });

    it("SW diagonal is cleared when W is missing", () => {
        expect(BITMASK_TO_VARIANT[0x30]).toBe(BITMASK_TO_VARIANT[0x10]); // S+SW → S
    });

    it("NW diagonal is cleared when N is missing", () => {
        expect(BITMASK_TO_VARIANT[0xC0]).toBe(BITMASK_TO_VARIANT[0x40]); // W+NW → W
    });
});

// =============================================================================
// BITMASK_TO_VARIANT
// =============================================================================

describe("BITMASK_TO_VARIANT", () => {
    it("has exactly 256 entries", () => {
        expect(BITMASK_TO_VARIANT.length).toBe(256);
    });

    it("produces exactly 47 unique variant indices", () => {
        const unique = new Set<number>();
        for (let i = 0; i < 256; i++) unique.add(BITMASK_TO_VARIANT[i]);
        expect(unique.size).toBe(47);
    });

    it("all variant indices are in the range 0–46", () => {
        for (let i = 0; i < 256; i++) {
            expect(BITMASK_TO_VARIANT[i]).toBeGreaterThanOrEqual(0);
            expect(BITMASK_TO_VARIANT[i]).toBeLessThanOrEqual(46);
        }
    });

    it("maps 0 (isolated) to variant index 0", () => {
        expect(BITMASK_TO_VARIANT[0]).toBe(0);
    });

    it("maps 255 (fully surrounded) to variant index 46", () => {
        expect(BITMASK_TO_VARIANT[255]).toBe(46);
    });

    it("maps known bitmask values to correct variant indices", () => {
        // N-only = 1 → index of 1 in VARIANT_CANONICAL_MASKS = 1
        expect(BITMASK_TO_VARIANT[1]).toBe(1);
        // E-only = 4 → index of 4 = 2
        expect(BITMASK_TO_VARIANT[4]).toBe(2);
        // S-only = 16 → index of 16 = 5
        expect(BITMASK_TO_VARIANT[16]).toBe(5);
        // W-only = 64 → index of 64 = 13
        expect(BITMASK_TO_VARIANT[64]).toBe(13);
        // N+E = 5 → index of 5 = 3
        expect(BITMASK_TO_VARIANT[5]).toBe(3);
        // N+NE+E = 7 → index of 7 = 4
        expect(BITMASK_TO_VARIANT[7]).toBe(4);
    });
});

// =============================================================================
// Dynamic terrain
// =============================================================================

describe("Dynamic terrain", () => {
    it("adding a wall neighbor changes the bitmask", () => {
        const wallMembers = memberSet(TileType.WALL);

        const cells1: Record<string, TileType> = { "5,4": TileType.WALL };
        const mask1 = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells1));

        const cells2: Record<string, TileType> = { "5,4": TileType.WALL, "6,5": TileType.WALL };
        const mask2 = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells2));

        expect(mask1).toBe(1);  // N only
        expect(mask2).toBe(5);  // N + E
        expect(mask1).not.toBe(mask2);
    });

    it("removing a wall neighbor changes the bitmask", () => {
        const wallMembers = memberSet(TileType.WALL);

        const cells1: Record<string, TileType> = { "5,4": TileType.WALL, "6,5": TileType.WALL };
        const mask1 = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells1));

        const cells2: Record<string, TileType> = { "6,5": TileType.WALL };
        const mask2 = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells2));

        expect(mask1).toBe(5);  // N + E
        expect(mask2).toBe(4);  // E only
    });

    it("changing neighbor from wall to floor changes the bitmask", () => {
        const wallMembers = memberSet(TileType.WALL);

        const cells1: Record<string, TileType> = { "5,4": TileType.WALL };
        const mask1 = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells1));

        const cells2: Record<string, TileType> = { "5,4": TileType.FLOOR };
        const mask2 = computeAdjacencyMask(5, 5, wallMembers, false, mockAccessor(cells2));

        expect(mask1).toBe(1);
        expect(mask2).toBe(0);
    });
});
