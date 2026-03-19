# TileType → sprite reference (DawnLike checklist)

Use this list to assign sprites in `rogue-ts/src/platform/glyph-sprite-map.ts` inside `buildTileTypeSpriteMap()`.  
One line per TileType; copy the `m.set(...)` part and edit the `tile("Sheet", col, row)` to match the DawnLike PNG you chose.  
Sheet names = filenames in `rogue-ts/assets/tilesets/dawnlike/` (e.g. Floor, Wall, Pit1, Door0, Door1, Ground0).  
`col` = tile column (0 = left), `row` = tile row (0 = top), in 16×16 tile units.

---

## Floors and walls

```
FLOOR	m.set(TileType.FLOOR, tile("Sheet", 0, 0));
FLOOR_FLOODABLE	m.set(TileType.FLOOR_FLOODABLE, tile("Sheet", 0, 0));
CARPET	m.set(TileType.CARPET, tile("Sheet", 0, 0));
MARBLE_FLOOR	m.set(TileType.MARBLE_FLOOR, tile("Sheet", 0, 0));
GRANITE	m.set(TileType.GRANITE, tile("Sheet", 0, 0));
WALL	m.set(TileType.WALL, tile("Sheet", 0, 0));
```

## Chasm, holes, collapse, bridges

```
CHASM	m.set(TileType.CHASM, tile("Sheet", 0, 0));
CHASM_EDGE	m.set(TileType.CHASM_EDGE, tile("Sheet", 0, 0));
MACHINE_COLLAPSE_EDGE_DORMANT	m.set(TileType.MACHINE_COLLAPSE_EDGE_DORMANT, tile("Sheet", 0, 0));
MACHINE_COLLAPSE_EDGE_SPREADING	m.set(TileType.MACHINE_COLLAPSE_EDGE_SPREADING, tile("Sheet", 0, 0));
BRIDGE	m.set(TileType.BRIDGE, tile("Sheet", 0, 0));
BRIDGE_FALLING	m.set(TileType.BRIDGE_FALLING, tile("Sheet", 0, 0));
BRIDGE_EDGE	m.set(TileType.BRIDGE_EDGE, tile("Sheet", 0, 0));
STONE_BRIDGE	m.set(TileType.STONE_BRIDGE, tile("Sheet", 0, 0));
CHASM_WITH_HIDDEN_BRIDGE	m.set(TileType.CHASM_WITH_HIDDEN_BRIDGE, tile("Sheet", 0, 0));
CHASM_WITH_HIDDEN_BRIDGE_ACTIVE	m.set(TileType.CHASM_WITH_HIDDEN_BRIDGE_ACTIVE, tile("Sheet", 0, 0));
MACHINE_CHASM_EDGE	m.set(TileType.MACHINE_CHASM_EDGE, tile("Sheet", 0, 0));
HOLE	m.set(TileType.HOLE, tile("Sheet", 0, 0));
HOLE_GLOW	m.set(TileType.HOLE_GLOW, tile("Sheet", 0, 0));
HOLE_EDGE	m.set(TileType.HOLE_EDGE, tile("Sheet", 0, 0));
```

## Vegetation and plants

```
GRASS	m.set(TileType.GRASS, tile("Sheet", 0, 0));
DEAD_GRASS	m.set(TileType.DEAD_GRASS, tile("Sheet", 0, 0));
GRAY_FUNGUS	m.set(TileType.GRAY_FUNGUS, tile("Sheet", 0, 0));
LUMINESCENT_FUNGUS	m.set(TileType.LUMINESCENT_FUNGUS, tile("Sheet", 0, 0));
LICHEN	m.set(TileType.LICHEN, tile("Sheet", 0, 0));
HAY	m.set(TileType.HAY, tile("Sheet", 0, 0));
FOLIAGE	m.set(TileType.FOLIAGE, tile("Sheet", 0, 0));
DEAD_FOLIAGE	m.set(TileType.DEAD_FOLIAGE, tile("Sheet", 0, 0));
TRAMPLED_FOLIAGE	m.set(TileType.TRAMPLED_FOLIAGE, tile("Sheet", 0, 0));
FUNGUS_FOREST	m.set(TileType.FUNGUS_FOREST, tile("Sheet", 0, 0));
TRAMPLED_FUNGUS_FOREST	m.set(TileType.TRAMPLED_FUNGUS_FOREST, tile("Sheet", 0, 0));
BLOODFLOWER_STALK	m.set(TileType.BLOODFLOWER_STALK, tile("Sheet", 0, 0));
BLOODFLOWER_POD	m.set(TileType.BLOODFLOWER_POD, tile("Sheet", 0, 0));
ANCIENT_SPIRIT_VINES	m.set(TileType.ANCIENT_SPIRIT_VINES, tile("Sheet", 0, 0));
ANCIENT_SPIRIT_GRASS	m.set(TileType.ANCIENT_SPIRIT_GRASS, tile("Sheet", 0, 0));
```

## Liquids and water

```
DEEP_WATER	m.set(TileType.DEEP_WATER, tile("Sheet", 0, 0));
SHALLOW_WATER	m.set(TileType.SHALLOW_WATER, tile("Sheet", 0, 0));
MUD	m.set(TileType.MUD, tile("Sheet", 0, 0));
LAVA	m.set(TileType.LAVA, tile("Sheet", 0, 0));
LAVA_RETRACTABLE	m.set(TileType.LAVA_RETRACTABLE, tile("Sheet", 0, 0));
LAVA_RETRACTING	m.set(TileType.LAVA_RETRACTING, tile("Sheet", 0, 0));
FLOOD_WATER_DEEP	m.set(TileType.FLOOD_WATER_DEEP, tile("Sheet", 0, 0));
FLOOD_WATER_SHALLOW	m.set(TileType.FLOOD_WATER_SHALLOW, tile("Sheet", 0, 0));
MACHINE_FLOOD_WATER_DORMANT	m.set(TileType.MACHINE_FLOOD_WATER_DORMANT, tile("Sheet", 0, 0));
MACHINE_FLOOD_WATER_SPREADING	m.set(TileType.MACHINE_FLOOD_WATER_SPREADING, tile("Sheet", 0, 0));
MACHINE_MUD_DORMANT	m.set(TileType.MACHINE_MUD_DORMANT, tile("Sheet", 0, 0));
DEEP_WATER_ALGAE_WELL	m.set(TileType.DEEP_WATER_ALGAE_WELL, tile("Sheet", 0, 0));
DEEP_WATER_ALGAE_1	m.set(TileType.DEEP_WATER_ALGAE_1, tile("Sheet", 0, 0));
DEEP_WATER_ALGAE_2	m.set(TileType.DEEP_WATER_ALGAE_2, tile("Sheet", 0, 0));
```

## Doors

```
DOOR	m.set(TileType.DOOR, tile("Sheet", 0, 0));
OPEN_DOOR	m.set(TileType.OPEN_DOOR, tile("Sheet", 0, 0));
SECRET_DOOR	m.set(TileType.SECRET_DOOR, tile("Sheet", 0, 0));
LOCKED_DOOR	m.set(TileType.LOCKED_DOOR, tile("Sheet", 0, 0));
OPEN_IRON_DOOR_INERT	m.set(TileType.OPEN_IRON_DOOR_INERT, tile("Sheet", 0, 0));
```

## Stairs and exits

```
DOWN_STAIRS	m.set(TileType.DOWN_STAIRS, tile("Sheet", 0, 0));
UP_STAIRS	m.set(TileType.UP_STAIRS, tile("Sheet", 0, 0));
DUNGEON_EXIT	m.set(TileType.DUNGEON_EXIT, tile("Sheet", 0, 0));
DUNGEON_PORTAL	m.set(TileType.DUNGEON_PORTAL, tile("Sheet", 0, 0));
```

## Wall features (torches, portcullis, levers, statues, etc.)

```
TORCH_WALL	m.set(TileType.TORCH_WALL, tile("Sheet", 0, 0));
CRYSTAL_WALL	m.set(TileType.CRYSTAL_WALL, tile("Sheet", 0, 0));
PORTCULLIS_CLOSED	m.set(TileType.PORTCULLIS_CLOSED, tile("Sheet", 0, 0));
PORTCULLIS_DORMANT	m.set(TileType.PORTCULLIS_DORMANT, tile("Sheet", 0, 0));
WOODEN_BARRICADE	m.set(TileType.WOODEN_BARRICADE, tile("Sheet", 0, 0));
PILOT_LIGHT_DORMANT	m.set(TileType.PILOT_LIGHT_DORMANT, tile("Sheet", 0, 0));
PILOT_LIGHT	m.set(TileType.PILOT_LIGHT, tile("Sheet", 0, 0));
HAUNTED_TORCH_DORMANT	m.set(TileType.HAUNTED_TORCH_DORMANT, tile("Sheet", 0, 0));
HAUNTED_TORCH_TRANSITIONING	m.set(TileType.HAUNTED_TORCH_TRANSITIONING, tile("Sheet", 0, 0));
HAUNTED_TORCH	m.set(TileType.HAUNTED_TORCH, tile("Sheet", 0, 0));
WALL_LEVER_HIDDEN	m.set(TileType.WALL_LEVER_HIDDEN, tile("Sheet", 0, 0));
WALL_LEVER	m.set(TileType.WALL_LEVER, tile("Sheet", 0, 0));
WALL_LEVER_PULLED	m.set(TileType.WALL_LEVER_PULLED, tile("Sheet", 0, 0));
WALL_LEVER_HIDDEN_DORMANT	m.set(TileType.WALL_LEVER_HIDDEN_DORMANT, tile("Sheet", 0, 0));
STATUE_INERT	m.set(TileType.STATUE_INERT, tile("Sheet", 0, 0));
STATUE_DORMANT	m.set(TileType.STATUE_DORMANT, tile("Sheet", 0, 0));
STATUE_CRACKING	m.set(TileType.STATUE_CRACKING, tile("Sheet", 0, 0));
STATUE_INSTACRACK	m.set(TileType.STATUE_INSTACRACK, tile("Sheet", 0, 0));
PORTAL	m.set(TileType.PORTAL, tile("Sheet", 0, 0));
TURRET_DORMANT	m.set(TileType.TURRET_DORMANT, tile("Sheet", 0, 0));
WALL_MONSTER_DORMANT	m.set(TileType.WALL_MONSTER_DORMANT, tile("Sheet", 0, 0));
RAT_TRAP_WALL_DORMANT	m.set(TileType.RAT_TRAP_WALL_DORMANT, tile("Sheet", 0, 0));
RAT_TRAP_WALL_CRACKING	m.set(TileType.RAT_TRAP_WALL_CRACKING, tile("Sheet", 0, 0));
ELECTRIC_CRYSTAL_OFF	m.set(TileType.ELECTRIC_CRYSTAL_OFF, tile("Sheet", 0, 0));
ELECTRIC_CRYSTAL_ON	m.set(TileType.ELECTRIC_CRYSTAL_ON, tile("Sheet", 0, 0));
TURRET_LEVER	m.set(TileType.TURRET_LEVER, tile("Sheet", 0, 0));
BRAZIER	m.set(TileType.BRAZIER, tile("Sheet", 0, 0));
```

## Dark floor and machine floors

```
DARK_FLOOR_DORMANT	m.set(TileType.DARK_FLOOR_DORMANT, tile("Sheet", 0, 0));
DARK_FLOOR_DARKENING	m.set(TileType.DARK_FLOOR_DARKENING, tile("Sheet", 0, 0));
DARK_FLOOR	m.set(TileType.DARK_FLOOR, tile("Sheet", 0, 0));
MACHINE_TRIGGER_FLOOR	m.set(TileType.MACHINE_TRIGGER_FLOOR, tile("Sheet", 0, 0));
MACHINE_TRIGGER_FLOOR_REPEATING	m.set(TileType.MACHINE_TRIGGER_FLOOR_REPEATING, tile("Sheet", 0, 0));
MACHINE_PRESSURE_PLATE	m.set(TileType.MACHINE_PRESSURE_PLATE, tile("Sheet", 0, 0));
MACHINE_PRESSURE_PLATE_USED	m.set(TileType.MACHINE_PRESSURE_PLATE_USED, tile("Sheet", 0, 0));
MACHINE_GLYPH	m.set(TileType.MACHINE_GLYPH, tile("Sheet", 0, 0));
MACHINE_GLYPH_INACTIVE	m.set(TileType.MACHINE_GLYPH_INACTIVE, tile("Sheet", 0, 0));
```

## Altars, cages, coffins

```
ALTAR_INERT	m.set(TileType.ALTAR_INERT, tile("Sheet", 0, 0));
ALTAR_KEYHOLE	m.set(TileType.ALTAR_KEYHOLE, tile("Sheet", 0, 0));
ALTAR_CAGE_OPEN	m.set(TileType.ALTAR_CAGE_OPEN, tile("Sheet", 0, 0));
ALTAR_CAGE_CLOSED	m.set(TileType.ALTAR_CAGE_CLOSED, tile("Sheet", 0, 0));
ALTAR_SWITCH	m.set(TileType.ALTAR_SWITCH, tile("Sheet", 0, 0));
ALTAR_SWITCH_RETRACTING	m.set(TileType.ALTAR_SWITCH_RETRACTING, tile("Sheet", 0, 0));
ALTAR_CAGE_RETRACTABLE	m.set(TileType.ALTAR_CAGE_RETRACTABLE, tile("Sheet", 0, 0));
PEDESTAL	m.set(TileType.PEDESTAL, tile("Sheet", 0, 0));
MONSTER_CAGE_OPEN	m.set(TileType.MONSTER_CAGE_OPEN, tile("Sheet", 0, 0));
MONSTER_CAGE_CLOSED	m.set(TileType.MONSTER_CAGE_CLOSED, tile("Sheet", 0, 0));
COFFIN_CLOSED	m.set(TileType.COFFIN_CLOSED, tile("Sheet", 0, 0));
COFFIN_OPEN	m.set(TileType.COFFIN_OPEN, tile("Sheet", 0, 0));
COMMUTATION_ALTAR	m.set(TileType.COMMUTATION_ALTAR, tile("Sheet", 0, 0));
COMMUTATION_ALTAR_INERT	m.set(TileType.COMMUTATION_ALTAR_INERT, tile("Sheet", 0, 0));
RESURRECTION_ALTAR	m.set(TileType.RESURRECTION_ALTAR, tile("Sheet", 0, 0));
RESURRECTION_ALTAR_INERT	m.set(TileType.RESURRECTION_ALTAR_INERT, tile("Sheet", 0, 0));
SACRIFICE_ALTAR_DORMANT	m.set(TileType.SACRIFICE_ALTAR_DORMANT, tile("Sheet", 0, 0));
SACRIFICE_ALTAR	m.set(TileType.SACRIFICE_ALTAR, tile("Sheet", 0, 0));
SACRIFICE_LAVA	m.set(TileType.SACRIFICE_LAVA, tile("Sheet", 0, 0));
SACRIFICE_CAGE_DORMANT	m.set(TileType.SACRIFICE_CAGE_DORMANT, tile("Sheet", 0, 0));
DEMONIC_STATUE	m.set(TileType.DEMONIC_STATUE, tile("Sheet", 0, 0));
STATUE_INERT_DOORWAY	m.set(TileType.STATUE_INERT_DOORWAY, tile("Sheet", 0, 0));
STATUE_DORMANT_DOORWAY	m.set(TileType.STATUE_DORMANT_DOORWAY, tile("Sheet", 0, 0));
```

## Traps (gas, trapdoor, vents, etc.)

```
GAS_TRAP_POISON_HIDDEN	m.set(TileType.GAS_TRAP_POISON_HIDDEN, tile("Sheet", 0, 0));
GAS_TRAP_POISON	m.set(TileType.GAS_TRAP_POISON, tile("Sheet", 0, 0));
TRAP_DOOR_HIDDEN	m.set(TileType.TRAP_DOOR_HIDDEN, tile("Sheet", 0, 0));
TRAP_DOOR	m.set(TileType.TRAP_DOOR, tile("Sheet", 0, 0));
GAS_TRAP_PARALYSIS_HIDDEN	m.set(TileType.GAS_TRAP_PARALYSIS_HIDDEN, tile("Sheet", 0, 0));
GAS_TRAP_PARALYSIS	m.set(TileType.GAS_TRAP_PARALYSIS, tile("Sheet", 0, 0));
MACHINE_PARALYSIS_VENT_HIDDEN	m.set(TileType.MACHINE_PARALYSIS_VENT_HIDDEN, tile("Sheet", 0, 0));
MACHINE_PARALYSIS_VENT	m.set(TileType.MACHINE_PARALYSIS_VENT, tile("Sheet", 0, 0));
GAS_TRAP_CONFUSION_HIDDEN	m.set(TileType.GAS_TRAP_CONFUSION_HIDDEN, tile("Sheet", 0, 0));
GAS_TRAP_CONFUSION	m.set(TileType.GAS_TRAP_CONFUSION, tile("Sheet", 0, 0));
FLAMETHROWER_HIDDEN	m.set(TileType.FLAMETHROWER_HIDDEN, tile("Sheet", 0, 0));
FLAMETHROWER	m.set(TileType.FLAMETHROWER, tile("Sheet", 0, 0));
FLOOD_TRAP_HIDDEN	m.set(TileType.FLOOD_TRAP_HIDDEN, tile("Sheet", 0, 0));
FLOOD_TRAP	m.set(TileType.FLOOD_TRAP, tile("Sheet", 0, 0));
NET_TRAP_HIDDEN	m.set(TileType.NET_TRAP_HIDDEN, tile("Sheet", 0, 0));
NET_TRAP	m.set(TileType.NET_TRAP, tile("Sheet", 0, 0));
ALARM_TRAP_HIDDEN	m.set(TileType.ALARM_TRAP_HIDDEN, tile("Sheet", 0, 0));
ALARM_TRAP	m.set(TileType.ALARM_TRAP, tile("Sheet", 0, 0));
MACHINE_POISON_GAS_VENT_HIDDEN	m.set(TileType.MACHINE_POISON_GAS_VENT_HIDDEN, tile("Sheet", 0, 0));
MACHINE_POISON_GAS_VENT_DORMANT	m.set(TileType.MACHINE_POISON_GAS_VENT_DORMANT, tile("Sheet", 0, 0));
MACHINE_POISON_GAS_VENT	m.set(TileType.MACHINE_POISON_GAS_VENT, tile("Sheet", 0, 0));
MACHINE_METHANE_VENT_HIDDEN	m.set(TileType.MACHINE_METHANE_VENT_HIDDEN, tile("Sheet", 0, 0));
MACHINE_METHANE_VENT_DORMANT	m.set(TileType.MACHINE_METHANE_VENT_DORMANT, tile("Sheet", 0, 0));
MACHINE_METHANE_VENT	m.set(TileType.MACHINE_METHANE_VENT, tile("Sheet", 0, 0));
STEAM_VENT	m.set(TileType.STEAM_VENT, tile("Sheet", 0, 0));
DEWAR_CAUSTIC_GAS	m.set(TileType.DEWAR_CAUSTIC_GAS, tile("Sheet", 0, 0));
DEWAR_CONFUSION_GAS	m.set(TileType.DEWAR_CONFUSION_GAS, tile("Sheet", 0, 0));
DEWAR_PARALYSIS_GAS	m.set(TileType.DEWAR_PARALYSIS_GAS, tile("Sheet", 0, 0));
DEWAR_METHANE_GAS	m.set(TileType.DEWAR_METHANE_GAS, tile("Sheet", 0, 0));
```

## Special terrain (sunlight, darkness, brimstone, ice, mud room)

```
SUNLIGHT_POOL	m.set(TileType.SUNLIGHT_POOL, tile("Sheet", 0, 0));
DARKNESS_PATCH	m.set(TileType.DARKNESS_PATCH, tile("Sheet", 0, 0));
ACTIVE_BRIMSTONE	m.set(TileType.ACTIVE_BRIMSTONE, tile("Sheet", 0, 0));
INERT_BRIMSTONE	m.set(TileType.INERT_BRIMSTONE, tile("Sheet", 0, 0));
OBSIDIAN	m.set(TileType.OBSIDIAN, tile("Sheet", 0, 0));
ICE_DEEP	m.set(TileType.ICE_DEEP, tile("Sheet", 0, 0));
ICE_DEEP_MELT	m.set(TileType.ICE_DEEP_MELT, tile("Sheet", 0, 0));
ICE_SHALLOW	m.set(TileType.ICE_SHALLOW, tile("Sheet", 0, 0));
ICE_SHALLOW_MELT	m.set(TileType.ICE_SHALLOW_MELT, tile("Sheet", 0, 0));
MUD_FLOOR	m.set(TileType.MUD_FLOOR, tile("Sheet", 0, 0));
MUD_WALL	m.set(TileType.MUD_WALL, tile("Sheet", 0, 0));
MUD_DOORWAY	m.set(TileType.MUD_DOORWAY, tile("Sheet", 0, 0));
```

## Decals and debris

```
RED_BLOOD	m.set(TileType.RED_BLOOD, tile("Sheet", 0, 0));
GREEN_BLOOD	m.set(TileType.GREEN_BLOOD, tile("Sheet", 0, 0));
PURPLE_BLOOD	m.set(TileType.PURPLE_BLOOD, tile("Sheet", 0, 0));
ACID_SPLATTER	m.set(TileType.ACID_SPLATTER, tile("Sheet", 0, 0));
VOMIT	m.set(TileType.VOMIT, tile("Sheet", 0, 0));
URINE	m.set(TileType.URINE, tile("Sheet", 0, 0));
UNICORN_POOP	m.set(TileType.UNICORN_POOP, tile("Sheet", 0, 0));
WORM_BLOOD	m.set(TileType.WORM_BLOOD, tile("Sheet", 0, 0));
ASH	m.set(TileType.ASH, tile("Sheet", 0, 0));
BURNED_CARPET	m.set(TileType.BURNED_CARPET, tile("Sheet", 0, 0));
PUDDLE	m.set(TileType.PUDDLE, tile("Sheet", 0, 0));
BONES	m.set(TileType.BONES, tile("Sheet", 0, 0));
RUBBLE	m.set(TileType.RUBBLE, tile("Sheet", 0, 0));
JUNK	m.set(TileType.JUNK, tile("Sheet", 0, 0));
BROKEN_GLASS	m.set(TileType.BROKEN_GLASS, tile("Sheet", 0, 0));
ECTOPLASM	m.set(TileType.ECTOPLASM, tile("Sheet", 0, 0));
EMBERS	m.set(TileType.EMBERS, tile("Sheet", 0, 0));
SPIDERWEB	m.set(TileType.SPIDERWEB, tile("Sheet", 0, 0));
NETTING	m.set(TileType.NETTING, tile("Sheet", 0, 0));
```

## Forcefield, glyphs, manacles

```
FORCEFIELD	m.set(TileType.FORCEFIELD, tile("Sheet", 0, 0));
FORCEFIELD_MELT	m.set(TileType.FORCEFIELD_MELT, tile("Sheet", 0, 0));
SACRED_GLYPH	m.set(TileType.SACRED_GLYPH, tile("Sheet", 0, 0));
MANACLE_TL	m.set(TileType.MANACLE_TL, tile("Sheet", 0, 0));
MANACLE_BR	m.set(TileType.MANACLE_BR, tile("Sheet", 0, 0));
MANACLE_TR	m.set(TileType.MANACLE_TR, tile("Sheet", 0, 0));
MANACLE_BL	m.set(TileType.MANACLE_BL, tile("Sheet", 0, 0));
MANACLE_T	m.set(TileType.MANACLE_T, tile("Sheet", 0, 0));
MANACLE_B	m.set(TileType.MANACLE_B, tile("Sheet", 0, 0));
MANACLE_L	m.set(TileType.MANACLE_L, tile("Sheet", 0, 0));
MANACLE_R	m.set(TileType.MANACLE_R, tile("Sheet", 0, 0));
```

## Portal, guardian, switch, pipes

```
PORTAL_LIGHT	m.set(TileType.PORTAL_LIGHT, tile("Sheet", 0, 0));
GUARDIAN_GLOW	m.set(TileType.GUARDIAN_GLOW, tile("Sheet", 0, 0));
AMULET_SWITCH	m.set(TileType.AMULET_SWITCH, tile("Sheet", 0, 0));
PIPE_GLOWING	m.set(TileType.PIPE_GLOWING, tile("Sheet", 0, 0));
PIPE_INERT	m.set(TileType.PIPE_INERT, tile("Sheet", 0, 0));
```

## Fire and gas (overlays)

```
PLAIN_FIRE	m.set(TileType.PLAIN_FIRE, tile("Sheet", 0, 0));
BRIMSTONE_FIRE	m.set(TileType.BRIMSTONE_FIRE, tile("Sheet", 0, 0));
FLAMEDANCER_FIRE	m.set(TileType.FLAMEDANCER_FIRE, tile("Sheet", 0, 0));
GAS_FIRE	m.set(TileType.GAS_FIRE, tile("Sheet", 0, 0));
GAS_EXPLOSION	m.set(TileType.GAS_EXPLOSION, tile("Sheet", 0, 0));
DART_EXPLOSION	m.set(TileType.DART_EXPLOSION, tile("Sheet", 0, 0));
ITEM_FIRE	m.set(TileType.ITEM_FIRE, tile("Sheet", 0, 0));
CREATURE_FIRE	m.set(TileType.CREATURE_FIRE, tile("Sheet", 0, 0));
POISON_GAS	m.set(TileType.POISON_GAS, tile("Sheet", 0, 0));
CONFUSION_GAS	m.set(TileType.CONFUSION_GAS, tile("Sheet", 0, 0));
ROT_GAS	m.set(TileType.ROT_GAS, tile("Sheet", 0, 0));
STENCH_SMOKE_GAS	m.set(TileType.STENCH_SMOKE_GAS, tile("Sheet", 0, 0));
PARALYSIS_GAS	m.set(TileType.PARALYSIS_GAS, tile("Sheet", 0, 0));
METHANE_GAS	m.set(TileType.METHANE_GAS, tile("Sheet", 0, 0));
STEAM	m.set(TileType.STEAM, tile("Sheet", 0, 0));
DARKNESS_CLOUD	m.set(TileType.DARKNESS_CLOUD, tile("Sheet", 0, 0));
HEALING_CLOUD	m.set(TileType.HEALING_CLOUD, tile("Sheet", 0, 0));
```

## Misc (bedroll, worm tunnel)

```
HAVEN_BEDROLL	m.set(TileType.HAVEN_BEDROLL, tile("Sheet", 0, 0));
WORM_TUNNEL_MARKER_DORMANT	m.set(TileType.WORM_TUNNEL_MARKER_DORMANT, tile("Sheet", 0, 0));
WORM_TUNNEL_MARKER_ACTIVE	m.set(TileType.WORM_TUNNEL_MARKER_ACTIVE, tile("Sheet", 0, 0));
WORM_TUNNEL_OUTER_WALL	m.set(TileType.WORM_TUNNEL_OUTER_WALL, tile("Sheet", 0, 0));
```

---

_Omitted: `NOTHING`, `NUMBER_TILETYPES` (sentinel/count, not drawn)._
