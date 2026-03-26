/*
 *  tile-colors.ts — TileType → CSS color mapping for the generation PoC
 *  dungeon-cake
 *
 *  Replaced by sprite rendering in Phase 1b.
 */

import { TileType } from "@game/types/enums.js";

const TILE_COLORS: Record<number, string> = {
    [TileType.NOTHING]:        "#000000",
    [TileType.GRANITE]:        "#404040",
    [TileType.FLOOR]:          "#8b7355",
    [TileType.FLOOR_FLOODABLE]:"#8b7355",
    [TileType.CARPET]:         "#6b2222",
    [TileType.MARBLE_FLOOR]:   "#c8b8a0",
    [TileType.WALL]:           "#666666",
    [TileType.DOOR]:           "#a0522d",
    [TileType.OPEN_DOOR]:      "#cd853f",
    [TileType.SECRET_DOOR]:    "#666666",
    [TileType.LOCKED_DOOR]:    "#8b4513",
    [TileType.DOWN_STAIRS]:    "#ffd700",
    [TileType.UP_STAIRS]:      "#daa520",
    [TileType.DUNGEON_EXIT]:   "#ff6600",
    [TileType.DUNGEON_PORTAL]: "#ff00ff",
    [TileType.TORCH_WALL]:     "#ff8800",
    [TileType.CRYSTAL_WALL]:   "#aaccff",
    [TileType.PORTCULLIS_CLOSED]:  "#888888",
    [TileType.PORTCULLIS_DORMANT]: "#888888",
    [TileType.WOODEN_BARRICADE]:   "#8b6914",
    [TileType.DEEP_WATER]:     "#000066",
    [TileType.SHALLOW_WATER]:  "#334499",
    [TileType.MUD]:            "#553311",
    [TileType.CHASM]:          "#110011",
    [TileType.CHASM_EDGE]:     "#1a0a1a",
    [TileType.LAVA]:           "#ff3300",
    [TileType.LAVA_RETRACTABLE]: "#ff3300",
    [TileType.SUNLIGHT_POOL]:  "#ffffaa",
    [TileType.DARKNESS_PATCH]: "#0a0a15",
    [TileType.OBSIDIAN]:       "#1a1a1a",
    [TileType.BRIDGE]:         "#886644",
    [TileType.BRIDGE_EDGE]:    "#775533",
    [TileType.STONE_BRIDGE]:   "#999999",
    [TileType.GRASS]:          "#228b22",
    [TileType.DEAD_GRASS]:     "#8b8b00",
    [TileType.GRAY_FUNGUS]:    "#808080",
    [TileType.LUMINESCENT_FUNGUS]: "#44ff88",
    [TileType.LICHEN]:         "#66aa44",
    [TileType.HAY]:            "#ccaa44",
    [TileType.FOLIAGE]:        "#006400",
    [TileType.DEAD_FOLIAGE]:   "#556b2f",
    [TileType.FUNGUS_FOREST]:  "#2f4f4f",
    [TileType.SPIDERWEB]:      "#cccccc",
    [TileType.RED_BLOOD]:      "#880000",
    [TileType.ALTAR_INERT]:    "#aa88cc",
    [TileType.ALTAR_CAGE_CLOSED]: "#8866aa",
    [TileType.PEDESTAL]:       "#aaaacc",
    [TileType.STATUE_INERT]:   "#aaaaaa",
    [TileType.MACHINE_TRIGGER_FLOOR]: "#8b7355",
    [TileType.MACHINE_PRESSURE_PLATE]: "#999977",
    [TileType.MACHINE_GLYPH]:  "#6666cc",
    [TileType.GAS_TRAP_POISON]: "#00aa00",
    [TileType.TRAP_DOOR]:      "#553300",
    [TileType.FLAMETHROWER]:   "#ff4400",
    [TileType.FLOOD_TRAP]:     "#0044aa",
    [TileType.NET_TRAP]:       "#cccc88",
    [TileType.ICE_DEEP]:       "#88ccff",
    [TileType.ICE_SHALLOW]:    "#aaddff",
    [TileType.HOLE]:           "#110011",
    [TileType.FORCEFIELD]:     "#4488ff",
    [TileType.SACRED_GLYPH]:   "#ffdd44",
    [TileType.PILOT_LIGHT]:    "#ff6600",
    [TileType.BRAZIER]:        "#ff8800",
    [TileType.COFFIN_CLOSED]:  "#554433",
    [TileType.INERT_BRIMSTONE]:"#884400",
    [TileType.ACTIVE_BRIMSTONE]:"#cc6600",
};

const DEFAULT_COLOR = "#1a1a2e";

export function getTileColor(tileType: number): string {
    return TILE_COLORS[tileType] ?? DEFAULT_COLOR;
}
