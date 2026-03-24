export const AUTOTILE_VARIANT_COUNT = 47;
export const AUTOTILE_GRID_COLS = 8;
export const AUTOTILE_GRID_ROWS = 6;

export const CONNECTION_GROUPS = [
  "WALL", "WATER", "LAVA", "CHASM", "FLOOR", "ICE", "MUD",
] as const;

export type ConnectionGroup = (typeof CONNECTION_GROUPS)[number];

/**
 * 47 canonical bitmask values matching the game's VARIANT_CANONICAL_MASKS
 * in rogue-ts/src/platform/autotile.ts. Variant index N in a spritesheet
 * corresponds to VARIANT_CANONICAL_MASKS[N]. Never reorder or remove.
 *
 * Bit layout (clockwise from N):
 *   Bit 0: N    Bit 1: NE   Bit 2: E    Bit 3: SE
 *   Bit 4: S    Bit 5: SW   Bit 6: W    Bit 7: NW
 */
export const VARIANT_CANONICAL_MASKS: readonly number[] = [
  0, 1, 4, 5, 7, 16, 17, 20, 21, 23,
  28, 29, 31, 64, 65, 68, 69, 71, 80, 81,
  84, 85, 87, 92, 93, 95, 112, 113, 116, 117,
  119, 124, 125, 127, 193, 197, 199, 209, 213, 215,
  221, 223, 241, 245, 247, 253, 255,
];

const N  = 1 << 0;
const NE = 1 << 1;
const E  = 1 << 2;
const SE = 1 << 3;
const S  = 1 << 4;
const SW = 1 << 5;
const W  = 1 << 6;
const NW = 1 << 7;

const DIRECTION_BITS = [
  { name: "N",  bit: N,  row: 0, col: 1 },
  { name: "NE", bit: NE, row: 0, col: 2 },
  { name: "E",  bit: E,  row: 1, col: 2 },
  { name: "SE", bit: SE, row: 2, col: 2 },
  { name: "S",  bit: S,  row: 2, col: 1 },
  { name: "SW", bit: SW, row: 2, col: 0 },
  { name: "W",  bit: W,  row: 1, col: 0 },
  { name: "NW", bit: NW, row: 0, col: 0 },
];

export interface VariantInfo {
  index: number;
  mask: number;
  /** 3×3 grid: true = connected neighbor, null = self (center) */
  neighbors: (boolean | null)[][];
}

export function getVariantInfo(index: number): VariantInfo {
  const mask = VARIANT_CANONICAL_MASKS[index] ?? 0;
  const grid: (boolean | null)[][] = [
    [false, false, false],
    [false, null,  false],
    [false, false, false],
  ];
  for (const d of DIRECTION_BITS) {
    grid[d.row]![d.col] = (mask & d.bit) !== 0;
  }
  return { index, mask, neighbors: grid };
}

export function createEmptyVariants(): (null)[] {
  return new Array(AUTOTILE_VARIANT_COUNT).fill(null);
}
