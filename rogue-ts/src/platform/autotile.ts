/*
 *  platform/autotile.ts — Autotile connection groups and bitmask computation
 *  Port V2 — rogue-ts
 *
 *  Pure configuration module: connection group membership, 8-bit adjacency
 *  bitmask computation, and the 256→47 variant reduction table. No state,
 *  no rendering dependencies.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { TileType, DungeonLayer } from "../types/enums.js";

// =============================================================================
// Constants
// =============================================================================

export const AUTOTILE_VARIANT_COUNT = 47;

/**
 * Neighbor offsets clockwise from North (y-down screen coordinates).
 * Index = bit position in the adjacency bitmask.
 *
 *   Bit 7: NW (-1,-1)   Bit 0: N (0,-1)    Bit 1: NE (1,-1)
 *   Bit 6: W  (-1, 0)   [self]              Bit 2: E  (1, 0)
 *   Bit 5: SW (-1, 1)   Bit 4: S (0, 1)    Bit 3: SE (1, 1)
 */
export const AUTOTILE_OFFSETS: readonly [number, number][] = [
    [0, -1],   // N   bit 0
    [1, -1],   // NE  bit 1
    [1, 0],    // E   bit 2
    [1, 1],    // SE  bit 3
    [0, 1],    // S   bit 4
    [-1, 1],   // SW  bit 5
    [-1, 0],   // W   bit 6
    [-1, -1],  // NW  bit 7
];

const N  = 1 << 0;
const NE = 1 << 1;
const E  = 1 << 2;
const SE = 1 << 3;
const S  = 1 << 4;
const SW = 1 << 5;
const W  = 1 << 6;
const NW = 1 << 7;

// =============================================================================
// Connection groups
// =============================================================================

export interface ConnectionGroupInfo {
    group: string;
    dungeonLayer: DungeonLayer;
    members: Uint8Array;
    oobConnects: boolean;
}

interface GroupDef {
    group: string;
    dungeonLayer: DungeonLayer;
    oobConnects: boolean;
    tileTypes: TileType[];
}

const TILE_TYPE_COUNT = TileType.NUMBER_TILETYPES;

const GROUP_DEFS: readonly GroupDef[] = [
    {
        group: "WALL",
        dungeonLayer: DungeonLayer.Dungeon,
        oobConnects: true,
        tileTypes: [
            TileType.GRANITE, TileType.WALL, TileType.SECRET_DOOR,
            TileType.TORCH_WALL, TileType.CRYSTAL_WALL,
            TileType.WALL_LEVER_HIDDEN, TileType.WALL_LEVER_HIDDEN_DORMANT,
            TileType.WALL_MONSTER_DORMANT,
            TileType.RAT_TRAP_WALL_DORMANT, TileType.RAT_TRAP_WALL_CRACKING,
            TileType.WORM_TUNNEL_OUTER_WALL, TileType.MUD_WALL,
            TileType.DOOR,
            // OPEN_DOOR is in the WALL group because the door frame is
            // structurally part of the wall — wall autotile variants shouldn't
            // change when a door swings open. CDDA uses the same approach.
            TileType.OPEN_DOOR,
            TileType.LOCKED_DOOR,
            TileType.PORTCULLIS_CLOSED, TileType.PORTCULLIS_DORMANT,
            TileType.WOODEN_BARRICADE,
            TileType.MUD_DOORWAY,
            TileType.TURRET_DORMANT,
            TileType.OPEN_IRON_DOOR_INERT,
        ],
    },
    {
        group: "WATER",
        dungeonLayer: DungeonLayer.Liquid,
        oobConnects: false,
        tileTypes: [
            TileType.DEEP_WATER, TileType.SHALLOW_WATER,
            TileType.FLOOD_WATER_DEEP, TileType.FLOOD_WATER_SHALLOW,
            TileType.MACHINE_FLOOD_WATER_DORMANT,
            TileType.MACHINE_FLOOD_WATER_SPREADING,
            TileType.DEEP_WATER_ALGAE_WELL,
            TileType.DEEP_WATER_ALGAE_1, TileType.DEEP_WATER_ALGAE_2,
        ],
    },
    {
        group: "LAVA",
        dungeonLayer: DungeonLayer.Liquid,
        oobConnects: false,
        tileTypes: [
            TileType.LAVA, TileType.LAVA_RETRACTABLE, TileType.LAVA_RETRACTING,
            TileType.ACTIVE_BRIMSTONE, TileType.SACRIFICE_LAVA,
        ],
    },
    {
        group: "CHASM",
        dungeonLayer: DungeonLayer.Liquid,
        oobConnects: false,
        tileTypes: [
            TileType.CHASM,
            TileType.MACHINE_COLLAPSE_EDGE_DORMANT,
            TileType.MACHINE_COLLAPSE_EDGE_SPREADING,
            TileType.CHASM_WITH_HIDDEN_BRIDGE,
            TileType.CHASM_WITH_HIDDEN_BRIDGE_ACTIVE,
            TileType.HOLE, TileType.HOLE_GLOW,
        ],
    },
    {
        group: "FLOOR",
        dungeonLayer: DungeonLayer.Dungeon,
        oobConnects: false,
        tileTypes: [
            TileType.FLOOR, TileType.FLOOR_FLOODABLE,
            TileType.CARPET, TileType.MARBLE_FLOOR,
            TileType.DARK_FLOOR_DORMANT, TileType.DARK_FLOOR_DARKENING,
            TileType.DARK_FLOOR,
            TileType.MACHINE_TRIGGER_FLOOR,
            TileType.MACHINE_TRIGGER_FLOOR_REPEATING,
            TileType.MUD_FLOOR,
            // Chasm/hole edge types are walkable (flags: 0) and live on
            // DungeonLayer.Liquid, but they're functionally floor. Placing
            // them here means: (a) FLOOR autotile extends seamlessly across
            // the edge, and (b) CHASM autotile correctly shows cliff edges
            // where deep chasm meets the walkable boundary. The liquid-path
            // adjacency accessor applies the chasm-override so these tiles
            // see each other via the liquid layer despite FLOOR's dungeon-
            // layer read.
            TileType.CHASM_EDGE,
            TileType.MACHINE_CHASM_EDGE,
            TileType.HOLE_EDGE,
        ],
    },
    {
        group: "ICE",
        dungeonLayer: DungeonLayer.Liquid,
        oobConnects: false,
        tileTypes: [
            TileType.ICE_DEEP, TileType.ICE_DEEP_MELT,
            TileType.ICE_SHALLOW, TileType.ICE_SHALLOW_MELT,
        ],
    },
    {
        group: "MUD",
        dungeonLayer: DungeonLayer.Liquid,
        oobConnects: false,
        tileTypes: [
            TileType.MUD, TileType.MACHINE_MUD_DORMANT,
        ],
    },
];

function buildConnectionGroupMap(): Map<TileType, ConnectionGroupInfo> {
    const map = new Map<TileType, ConnectionGroupInfo>();
    for (const def of GROUP_DEFS) {
        const members = new Uint8Array(TILE_TYPE_COUNT);
        for (const tt of def.tileTypes) {
            members[tt] = 1;
        }
        const info: ConnectionGroupInfo = {
            group: def.group,
            dungeonLayer: def.dungeonLayer,
            members,
            oobConnects: def.oobConnects,
        };
        for (const tt of def.tileTypes) {
            map.set(tt, info);
        }
    }
    return map;
}

const connectionGroupMap = buildConnectionGroupMap();

/**
 * Look up the connection group info for a TileType.
 * Returns `undefined` for non-connectable types (stairs, traps, items, etc.).
 */
export function getConnectionGroupInfo(tileType: TileType): ConnectionGroupInfo | undefined {
    return connectionGroupMap.get(tileType);
}

// =============================================================================
// Bitmask computation
// =============================================================================

/**
 * Compute the 8-bit adjacency bitmask for a cell at (x, y).
 *
 * For each of the 8 neighbors (clockwise from North), `getNeighborTile`
 * returns the TileType at that position, or `undefined` for out-of-bounds
 * / shroud cells. The bit is set when the neighbor belongs to the same
 * connection group, or when undefined and `oobConnects` is true.
 */
export function computeAdjacencyMask(
    x: number,
    y: number,
    groupMembers: Uint8Array,
    oobConnects: boolean,
    getNeighborTile: (nx: number, ny: number) => TileType | undefined,
): number {
    let mask = 0;
    for (let i = 0; i < 8; i++) {
        const [dx, dy] = AUTOTILE_OFFSETS[i];
        const tile = getNeighborTile(x + dx, y + dy);
        const connects = tile === undefined
            ? oobConnects
            : groupMembers[tile] !== 0;
        if (connects) mask |= (1 << i);
    }
    return mask;
}

// =============================================================================
// 256→47 variant reduction
// =============================================================================

/**
 * The 47 canonical bitmask values, sorted ascending. Each value represents
 * a visually distinct tile shape after diagonal corners are cleared when
 * their adjacent cardinals are not both connected.
 *
 * This constant is the contract with the art pipeline: variant index N in
 * a spritesheet corresponds to `VARIANT_CANONICAL_MASKS[N]`.
 * **Never reorder or remove entries.**
 */
export const VARIANT_CANONICAL_MASKS: readonly number[] = [
    0, 1, 4, 5, 7, 16, 17, 20, 21, 23,
    28, 29, 31, 64, 65, 68, 69, 71, 80, 81,
    84, 85, 87, 92, 93, 95, 112, 113, 116, 117,
    119, 124, 125, 127, 193, 197, 199, 209, 213, 215,
    221, 223, 241, 245, 247, 253, 255,
] as const;

/**
 * Apply corner-clearing: diagonal bits are cleared when their two
 * adjacent cardinal neighbors are not both set.
 */
function canonicalizeMask(mask: number): number {
    let m = mask;
    if (!(m & N) || !(m & E)) m &= ~NE;
    if (!(m & S) || !(m & E)) m &= ~SE;
    if (!(m & S) || !(m & W)) m &= ~SW;
    if (!(m & N) || !(m & W)) m &= ~NW;
    return m;
}

function buildBitmaskToVariant(): Uint8Array {
    const canonicalToIndex = new Map<number, number>();
    for (let i = 0; i < VARIANT_CANONICAL_MASKS.length; i++) {
        canonicalToIndex.set(VARIANT_CANONICAL_MASKS[i], i);
    }
    const table = new Uint8Array(256);
    for (let raw = 0; raw < 256; raw++) {
        const canonical = canonicalizeMask(raw);
        const idx = canonicalToIndex.get(canonical);
        if (idx === undefined) {
            throw new Error(
                `Canonical mask ${canonical} (from raw ${raw}) not in VARIANT_CANONICAL_MASKS`,
            );
        }
        table[raw] = idx;
    }
    return table;
}

/**
 * Maps each of the 256 possible raw bitmasks to a variant index (0–46).
 * Precomputed at module load time.
 */
export const BITMASK_TO_VARIANT: Uint8Array = buildBitmaskToVariant();

// =============================================================================
// Wang Blob layout — 7×7 grid (49 cells, 2 empty corners = 47 unique variants)
// =============================================================================

export const WANG_BLOB_COLS = 7;
export const WANG_BLOB_ROWS = 7;

/**
 * Bitmask values arranged in the Wang Blob spatial layout. Connected
 * tiles are visually adjacent, making the template natural to draw on.
 * Zero-cells at (col=6, row=0) and (col=6, row=6) are empty corners;
 * (col=0, row=0) is the actual variant-0 cell (no connections).
 */
export const WANG_BLOB_GRID: readonly (readonly number[])[] = [
    [  0,   4,  92, 124, 116,  80,   0],
    [ 16,  20,  87, 223, 241,  21,  64],
    [ 29, 117,  85,  71, 221, 125, 112],
    [ 31, 253, 113,  28, 127, 247, 209],
    [ 23, 199, 213,  95, 255, 245,  81],
    [  5,  84,  93, 119, 215, 193,  17],
    [  0,   1,   7, 197,  69,  68,  65],
];

const WANG_BLOB_EMPTY_CORNERS: ReadonlySet<string> = new Set(["6,0", "0,6"]);

/**
 * Build a lookup from variant index (0–46) to Wang Blob grid {col, row}.
 * Used by wangVariants() in glyph-sprite-map.ts to map sheets
 * drawn in Wang Blob format directly.
 */
export function buildVariantToWangBlob(): Map<number, { col: number; row: number }> {
    const canonicalToIndex = new Map<number, number>();
    for (let i = 0; i < VARIANT_CANONICAL_MASKS.length; i++) {
        canonicalToIndex.set(VARIANT_CANONICAL_MASKS[i]!, i);
    }
    const map = new Map<number, { col: number; row: number }>();
    for (let row = 0; row < WANG_BLOB_ROWS; row++) {
        for (let col = 0; col < WANG_BLOB_COLS; col++) {
            const mask = WANG_BLOB_GRID[row]![col]!;
            if (mask === 0 && WANG_BLOB_EMPTY_CORNERS.has(`${col},${row}`)) continue;
            const variantIdx = canonicalToIndex.get(mask);
            if (variantIdx !== undefined) map.set(variantIdx, { col, row });
        }
    }
    return map;
}
