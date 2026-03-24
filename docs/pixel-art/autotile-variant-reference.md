# Autotile Variant Reference

Art handoff document for 47-variant blob autotile spritesheets. Each
connectable terrain type (walls, water, lava, chasm, floor, ice, mud)
needs a spritesheet with 47 sprites — one per variant below.

**Spritesheet layout:** 47 sprites in an 8×6 grid (48 slots, last unused),
indexed left-to-right then top-to-bottom by variant index. Sprite size
matches the base tile size (currently 16×16).

**Source of truth:** `VARIANT_CANONICAL_MASKS` in
`rogue-ts/src/platform/autotile.ts`.

## How to read the diagrams

Each variant shows a 3×3 grid. `■` = connected neighbor (same terrain
group), `·` = not connected, `X` = the tile itself.

```
NW  N  NE        bit 7  bit 0  bit 1
 W  X   E        bit 6  self   bit 2
SW  S  SE        bit 5  bit 4  bit 3
```

Diagonal corners (NE, SE, SW, NW) only appear as `■` when both adjacent
cardinal neighbors are also connected. This is the corner-clearing rule
that reduces 256 raw bitmasks to 47 canonical shapes.

---

## No cardinals connected (1 variant)

### Variant 0 — mask 0 (`00000000`)
```
·  ·  ·
·  X  ·
·  ·  ·
```

## One cardinal connected (4 variants)

### Variant 1 — mask 1 (`00000001`)
```
·  ■  ·
·  X  ·
·  ·  ·
```

### Variant 2 — mask 4 (`00000100`)
```
·  ·  ·
·  X  ■
·  ·  ·
```

### Variant 3 — mask 5 (`00000101`) — N+E without corner
```
·  ■  ·
·  X  ■
·  ·  ·
```

### Variant 5 — mask 16 (`00010000`)
```
·  ·  ·
·  X  ·
·  ■  ·
```

### Variant 13 — mask 64 (`01000000`)
```
·  ·  ·
■  X  ·
·  ·  ·
```

## Two cardinals connected (6 variants × corner combos)

### Variant 4 — mask 7 (`00000111`) — N+E with NE corner
```
·  ■  ■
·  X  ■
·  ·  ·
```

### Variant 6 — mask 17 (`00010001`) — N+S
```
·  ■  ·
·  X  ·
·  ■  ·
```

### Variant 7 — mask 20 (`00010100`) — E+S without corner
```
·  ·  ·
·  X  ■
·  ■  ·
```

### Variant 10 — mask 28 (`00011100`) — E+S with SE corner
```
·  ·  ·
·  X  ■
·  ■  ■
```

### Variant 14 — mask 65 (`01000001`) — N+W without corner
```
·  ■  ·
■  X  ·
·  ·  ·
```

### Variant 15 — mask 68 (`01000100`) — E+W
```
·  ·  ·
■  X  ■
·  ·  ·
```

### Variant 18 — mask 80 (`01010000`) — S+W without corner
```
·  ·  ·
■  X  ·
·  ■  ·
```

### Variant 26 — mask 112 (`01110000`) — S+W with SW corner
```
·  ·  ·
■  X  ·
■  ■  ·
```

### Variant 34 — mask 193 (`11000001`) — N+W with NW corner
```
■  ■  ·
■  X  ·
·  ·  ·
```

## Three cardinals connected (4 × corner combos)

### Variant 8 — mask 21 (`00010101`) — N+E+S, no corners
```
·  ■  ·
·  X  ■
·  ■  ·
```

### Variant 9 — mask 23 (`00010111`) — N+E+S, NE corner
```
·  ■  ■
·  X  ■
·  ■  ·
```

### Variant 11 — mask 29 (`00011101`) — N+E+S, SE corner
```
·  ■  ·
·  X  ■
·  ■  ■
```

### Variant 12 — mask 31 (`00011111`) — N+E+S, NE+SE corners
```
·  ■  ■
·  X  ■
·  ■  ■
```

### Variant 16 — mask 69 (`01000101`) — N+E+W, no corners
```
·  ■  ·
■  X  ■
·  ·  ·
```

### Variant 17 — mask 71 (`01000111`) — N+E+W, NE corner
```
·  ■  ■
■  X  ■
·  ·  ·
```

### Variant 35 — mask 197 (`11000101`) — N+E+W, NW corner
```
■  ■  ·
■  X  ■
·  ·  ·
```

### Variant 36 — mask 199 (`11000111`) — N+E+W, NE+NW corners
```
■  ■  ■
■  X  ■
·  ·  ·
```

### Variant 19 — mask 81 (`01010001`) — N+S+W, no corners
```
·  ■  ·
■  X  ·
·  ■  ·
```

### Variant 27 — mask 113 (`01110001`) — N+S+W, SW corner
```
·  ■  ·
■  X  ·
■  ■  ·
```

### Variant 37 — mask 209 (`11010001`) — N+S+W, NW corner
```
■  ■  ·
■  X  ·
·  ■  ·
```

### Variant 42 — mask 241 (`11110001`) — N+S+W, SW+NW corners
```
■  ■  ·
■  X  ·
■  ■  ·
```

### Variant 20 — mask 84 (`01010100`) — E+S+W, no corners
```
·  ·  ·
■  X  ■
·  ■  ·
```

### Variant 23 — mask 92 (`01011100`) — E+S+W, SE corner
```
·  ·  ·
■  X  ■
·  ■  ■
```

### Variant 28 — mask 116 (`01110100`) — E+S+W, SW corner
```
·  ·  ·
■  X  ■
■  ■  ·
```

### Variant 31 — mask 124 (`01111100`) — E+S+W, SE+SW corners
```
·  ·  ·
■  X  ■
■  ■  ■
```

## Four cardinals connected (16 corner combos)

### Variant 21 — mask 85 (`01010101`) — all cardinals, no corners
```
·  ■  ·
■  X  ■
·  ■  ·
```

### Variant 22 — mask 87 (`01010111`) — NE corner only
```
·  ■  ■
■  X  ■
·  ■  ·
```

### Variant 24 — mask 93 (`01011101`) — SE corner only
```
·  ■  ·
■  X  ■
·  ■  ■
```

### Variant 25 — mask 95 (`01011111`) — NE+SE corners
```
·  ■  ■
■  X  ■
·  ■  ■
```

### Variant 29 — mask 117 (`01110101`) — SW corner only
```
·  ■  ·
■  X  ■
■  ■  ·
```

### Variant 30 — mask 119 (`01110111`) — NE+SW corners
```
·  ■  ■
■  X  ■
■  ■  ·
```

### Variant 32 — mask 125 (`01111101`) — SE+SW corners
```
·  ■  ·
■  X  ■
■  ■  ■
```

### Variant 33 — mask 127 (`01111111`) — NE+SE+SW corners
```
·  ■  ■
■  X  ■
■  ■  ■
```

### Variant 38 — mask 213 (`11010101`) — NW corner only
```
■  ■  ·
■  X  ■
·  ■  ·
```

### Variant 39 — mask 215 (`11010111`) — NE+NW corners
```
■  ■  ■
■  X  ■
·  ■  ·
```

### Variant 40 — mask 221 (`11011101`) — SE+NW corners
```
■  ■  ·
■  X  ■
·  ■  ■
```

### Variant 41 — mask 223 (`11011111`) — NE+SE+NW corners
```
■  ■  ■
■  X  ■
·  ■  ■
```

### Variant 43 — mask 245 (`11110101`) — SW+NW corners
```
■  ■  ·
■  X  ■
■  ■  ·
```

### Variant 44 — mask 247 (`11110111`) — NE+SW+NW corners
```
■  ■  ■
■  X  ■
■  ■  ·
```

### Variant 45 — mask 253 (`11111101`) — SE+SW+NW corners
```
■  ■  ·
■  X  ■
■  ■  ■
```

### Variant 46 — mask 255 (`11111111`) — fully surrounded
```
■  ■  ■
■  X  ■
■  ■  ■
```

---

## Quick reference table

| Idx | Mask | Binary     | Cardinals | Corners         |
|-----|------|------------|-----------|-----------------|
|   0 |    0 | `00000000` | —         | —               |
|   1 |    1 | `00000001` | N         | —               |
|   2 |    4 | `00000100` | E         | —               |
|   3 |    5 | `00000101` | N E       | —               |
|   4 |    7 | `00000111` | N E       | NE              |
|   5 |   16 | `00010000` | S         | —               |
|   6 |   17 | `00010001` | N S       | —               |
|   7 |   20 | `00010100` | E S       | —               |
|   8 |   21 | `00010101` | N E S     | —               |
|   9 |   23 | `00010111` | N E S     | NE              |
|  10 |   28 | `00011100` | E S       | SE              |
|  11 |   29 | `00011101` | N E S     | SE              |
|  12 |   31 | `00011111` | N E S     | NE SE           |
|  13 |   64 | `01000000` | W         | —               |
|  14 |   65 | `01000001` | N W       | —               |
|  15 |   68 | `01000100` | E W       | —               |
|  16 |   69 | `01000101` | N E W     | —               |
|  17 |   71 | `01000111` | N E W     | NE              |
|  18 |   80 | `01010000` | S W       | —               |
|  19 |   81 | `01010001` | N S W     | —               |
|  20 |   84 | `01010100` | E S W     | —               |
|  21 |   85 | `01010101` | N E S W   | —               |
|  22 |   87 | `01010111` | N E S W   | NE              |
|  23 |   92 | `01011100` | E S W     | SE              |
|  24 |   93 | `01011101` | N E S W   | SE              |
|  25 |   95 | `01011111` | N E S W   | NE SE           |
|  26 |  112 | `01110000` | S W       | SW              |
|  27 |  113 | `01110001` | N S W     | SW              |
|  28 |  116 | `01110100` | E S W     | SW              |
|  29 |  117 | `01110101` | N E S W   | SW              |
|  30 |  119 | `01110111` | N E S W   | NE SW           |
|  31 |  124 | `01111100` | E S W     | SE SW           |
|  32 |  125 | `01111101` | N E S W   | SE SW           |
|  33 |  127 | `01111111` | N E S W   | NE SE SW        |
|  34 |  193 | `11000001` | N W       | NW              |
|  35 |  197 | `11000101` | N E W     | NW              |
|  36 |  199 | `11000111` | N E W     | NE NW           |
|  37 |  209 | `11010001` | N S W     | NW              |
|  38 |  213 | `11010101` | N E S W   | NW              |
|  39 |  215 | `11010111` | N E S W   | NE NW           |
|  40 |  221 | `11011101` | N E S W   | SE NW           |
|  41 |  223 | `11011111` | N E S W   | NE SE NW        |
|  42 |  241 | `11110001` | N S W     | SW NW           |
|  43 |  245 | `11110101` | N E S W   | SW NW           |
|  44 |  247 | `11110111` | N E S W   | NE SW NW        |
|  45 |  253 | `11111101` | N E S W   | SE SW NW        |
|  46 |  255 | `11111111` | N E S W   | NE SE SW NW     |

---

## Connection groups

| Group | oobConnects | Priority | Example types |
|-------|-------------|----------|---------------|
| WALL  | true        | High     | Granite, Wall, Door, Secret Door |
| WATER | false       | High     | Deep Water, Shallow Water |
| LAVA  | false       | High     | Lava, Active Brimstone |
| CHASM | false       | Medium   | Chasm, Hole, Chasm Edge |
| FLOOR | false       | Low      | Floor, Carpet, Marble Floor |
| ICE   | false       | Low      | Ice Deep, Ice Shallow |
| MUD   | false       | Low      | Mud |

Full member lists are in `rogue-ts/src/platform/autotile.ts`.
