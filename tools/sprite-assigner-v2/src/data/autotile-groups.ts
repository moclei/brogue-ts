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

function isWangBlobEmpty(col: number, row: number): boolean {
  return WANG_BLOB_GRID[row]![col] === 0 && WANG_BLOB_EMPTY_CORNERS.has(`${col},${row}`);
}

const maskToVariantIndex = new Map<number, number>();
for (let i = 0; i < VARIANT_CANONICAL_MASKS.length; i++) {
  maskToVariantIndex.set(VARIANT_CANONICAL_MASKS[i]!, i);
}

/**
 * Map a Wang Blob grid cell to its variant index (0–46).
 * Returns -1 for empty corner cells.
 */
export function wangBlobCellToVariant(col: number, row: number): number {
  if (isWangBlobEmpty(col, row)) return -1;
  const mask = WANG_BLOB_GRID[row]![col]!;
  return maskToVariantIndex.get(mask) ?? -1;
}

/**
 * Build a lookup from variant index → Wang Blob grid position.
 * Useful for placing sprites into the 7×7 layout.
 */
export function buildVariantToWangBlob(): Map<number, { col: number; row: number }> {
  const map = new Map<number, { col: number; row: number }>();
  for (let row = 0; row < WANG_BLOB_ROWS; row++) {
    for (let col = 0; col < WANG_BLOB_COLS; col++) {
      if (isWangBlobEmpty(col, row)) continue;
      const variantIdx = wangBlobCellToVariant(col, row);
      if (variantIdx >= 0) map.set(variantIdx, { col, row });
    }
  }
  return map;
}
