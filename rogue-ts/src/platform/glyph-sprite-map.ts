/*
 *  glyph-sprite-map.ts — DisplayGlyph/TileType → sprite region for tile rendering
 *  brogue-ts
 *
 *  Reads sprite-manifest.json and assignments.json to build maps from
 *  TileType/DisplayGlyph to SpriteRef coordinates. Autotile variant
 *  resolution uses per-group sheet + format declarations from assignments.json.
 */

import { DisplayGlyph, TileType } from "../types/enums.js";
import {
  getConnectionGroupInfo,
  AUTOTILE_VARIANT_COUNT,
  buildVariantToWangBlob,
} from "./autotile.js";
import defaultManifest from "../../assets/tilesets/sprite-manifest.json";
import _defaultAssignments from "../../assets/tilesets/assignments.json";

const defaultAssignments = _defaultAssignments as unknown as AssignmentsData;

export interface SpriteRef {
  sheetKey: string;
  tileX: number;
  tileY: number;
}

export interface SpriteManifest {
  tiles: Record<string, { x: number; y: number }>;
  glyphs: Record<string, { x: number; y: number }>;
}

export type AutotileFormat = "grid" | "wang";

export interface AutotileSheetRef {
  sheet: string;
  format: AutotileFormat;
}

export interface AssignmentsData {
  sheets?: { master: string };
  autotile?: Record<string, AutotileSheetRef>;
}

export const MASTER_SHEET_KEY = "master";
const TILESETS_BASE = "/assets/tilesets/";

/**
 * Build the TileType → sprite lookup from the master spritesheet manifest.
 * Unmapped TileTypes fall back to the DisplayGlyph-based sprite in the renderer.
 */
export function buildTileTypeSpriteMap(
  manifest: SpriteManifest = defaultManifest,
): Map<TileType, SpriteRef> {
  const m = new Map<TileType, SpriteRef>();
  for (const [name, coords] of Object.entries(manifest.tiles)) {
    const tt = TileType[name as keyof typeof TileType];
    if (tt !== undefined && typeof tt === "number") {
      m.set(tt, {
        sheetKey: MASTER_SHEET_KEY,
        tileX: coords.x,
        tileY: coords.y,
      });
    }
  }
  return m;
}

/**
 * Build a 47-element variant array from an 8×6 spritesheet grid.
 * Grid is indexed left-to-right, top-to-bottom by variant index.
 */
function gridVariants(sheetKey: string): SpriteRef[] {
  const variants: SpriteRef[] = [];
  for (let v = 0; v < AUTOTILE_VARIANT_COUNT; v++) {
    variants.push({ sheetKey, tileX: v % 8, tileY: Math.floor(v / 8) });
  }
  return variants;
}

let wangBlobMap: Map<number, { col: number; row: number }> | null = null;

/**
 * Build a 47-element variant array from a 7×7 Wang Blob spritesheet.
 * Each variant index maps to its spatial position in the Wang Blob
 * layout, where connected tiles are visually adjacent.
 */
function wangVariants(sheetKey: string): SpriteRef[] {
  if (!wangBlobMap) wangBlobMap = buildVariantToWangBlob();
  const variants: SpriteRef[] = [];
  for (let v = 0; v < AUTOTILE_VARIANT_COUNT; v++) {
    const pos = wangBlobMap.get(v);
    if (pos) {
      variants.push({ sheetKey, tileX: pos.col, tileY: pos.row });
    } else {
      variants.push({ sheetKey, tileX: 0, tileY: 0 });
    }
  }
  return variants;
}

const AUTOTILE_SKIP = new Set<TileType>([
  TileType.DOOR,
  TileType.OPEN_DOOR,
  TileType.LOCKED_DOOR,
  TileType.PORTCULLIS_CLOSED,
  TileType.PORTCULLIS_DORMANT,
  TileType.WOODEN_BARRICADE,
  TileType.MUD_DOORWAY,
  TileType.TURRET_DORMANT,
  TileType.OPEN_IRON_DOOR_INERT,
]);

/**
 * Resolve a 47-element variant array for a connection group.
 * The group's sheet key matches the connection group name (e.g. "WALL"),
 * and the format determines how variant indices map to grid coordinates.
 */
function resolveVariants(
  groupName: string,
  ref: AutotileSheetRef,
  cache: Map<string, SpriteRef[]>,
): SpriteRef[] {
  let variants = cache.get(groupName);
  if (variants) return variants;
  variants =
    ref.format === "wang"
      ? wangVariants(groupName)
      : gridVariants(groupName);
  cache.set(groupName, variants);
  return variants;
}

/**
 * Build the autotile variant map from assignments.json.
 *
 * For each connectable TileType whose connection group has an autotile
 * sheet declared in assignments.json, create a 47-element SpriteRef[]
 * with coordinates derived from the sheet's format. Types in AUTOTILE_SKIP
 * keep their own sprite. Types without a declared sheet get placeholder fills.
 */
export function buildAutotileVariantMap(
  tileTypeSpriteMap: Map<TileType, SpriteRef>,
  assignments: AssignmentsData = defaultAssignments,
): Map<TileType, SpriteRef[]> {
  const map = new Map<TileType, SpriteRef[]>();
  const variantCache = new Map<string, SpriteRef[]>();
  const autotileSheets = assignments.autotile ?? {};

  for (const [tileType, spriteRef] of tileTypeSpriteMap) {
    const groupInfo = getConnectionGroupInfo(tileType);
    if (!groupInfo) continue;
    const sheetRef = autotileSheets[groupInfo.group];
    if (sheetRef && !AUTOTILE_SKIP.has(tileType)) {
      map.set(
        tileType,
        resolveVariants(groupInfo.group, sheetRef, variantCache),
      );
    } else {
      map.set(
        tileType,
        new Array<SpriteRef>(AUTOTILE_VARIANT_COUNT).fill(spriteRef),
      );
    }
  }

  // Second pass: tile types with an autotile sheet but no manifest entry
  for (const val of Object.values(TileType)) {
    const tt = val as TileType;
    if (typeof tt !== "number" || map.has(tt)) continue;
    const groupInfo = getConnectionGroupInfo(tt);
    if (!groupInfo) continue;
    const sheetRef = autotileSheets[groupInfo.group];
    if (!sheetRef || AUTOTILE_SKIP.has(tt)) continue;
    map.set(tt, resolveVariants(groupInfo.group, sheetRef, variantCache));
  }

  return map;
}

/**
 * Build the glyph → sprite lookup from the master spritesheet manifest.
 * Unmapped glyphs return undefined; the renderer draws a fallback.
 */
export function buildGlyphSpriteMap(
  manifest: SpriteManifest = defaultManifest,
): Map<DisplayGlyph, SpriteRef> {
  const m = new Map<DisplayGlyph, SpriteRef>();
  for (const [name, coords] of Object.entries(manifest.glyphs)) {
    const dg = DisplayGlyph[name as keyof typeof DisplayGlyph];
    if (dg !== undefined && typeof dg === "number") {
      m.set(dg, {
        sheetKey: MASTER_SHEET_KEY,
        tileX: coords.x,
        tileY: coords.y,
      });
    }
  }
  return m;
}

/**
 * Fetch the sprite manifest from the dev server at runtime.
 * Used during HMR to get updated tile coordinates after the assigner saves.
 */
export async function fetchSpriteManifest(): Promise<SpriteManifest> {
  const resp = await fetch(
    `${TILESETS_BASE}sprite-manifest.json?t=${Date.now()}`,
  );
  if (!resp.ok)
    throw new Error(`Failed to fetch sprite manifest: ${resp.status}`);
  return resp.json() as Promise<SpriteManifest>;
}

/**
 * Fetch assignments.json from the dev server at runtime.
 * Used during HMR to pick up new autotile sheet assignments.
 */
export async function fetchAssignments(): Promise<AssignmentsData> {
  const resp = await fetch(
    `${TILESETS_BASE}assignments.json?t=${Date.now()}`,
  );
  if (!resp.ok)
    throw new Error(`Failed to fetch assignments: ${resp.status}`);
  return resp.json() as Promise<AssignmentsData>;
}

/**
 * Build the URL map for all tileset images from assignments.json.
 * Master sheet from `sheets.master`, autotile sheets keyed by group name.
 */
export function buildSheetUrls(
  assignments: AssignmentsData = defaultAssignments,
  bustSuffix = "",
): Record<string, string> {
  const urls: Record<string, string> = {};
  const masterPath = assignments.sheets?.master ?? "master-spritesheet.png";
  urls[MASTER_SHEET_KEY] = `${TILESETS_BASE}${masterPath}${bustSuffix}`;
  for (const [group, ref] of Object.entries(assignments.autotile ?? {})) {
    urls[group] = `${TILESETS_BASE}${ref.sheet}${bustSuffix}`;
  }
  return urls;
}
