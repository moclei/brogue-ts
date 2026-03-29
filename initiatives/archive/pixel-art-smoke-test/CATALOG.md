# DawnLike Tileset Catalog

Tileset location: `rogue-ts/assets/tilesets/dawnlike/`  
Format: 16×16 pixels per tile. Multiple PNGs; each image is a grid of tiles.

## Sheets present (from repo)

### Terrain / environment
- **Objects/Floor.png** — floor tiles
- **Objects/Wall.png** — walls
- **Objects/Ground0.png**, **Objects/Ground1.png** — ground variants
- **Objects/Hill0.png**, **Objects/Hill1.png**
- **Objects/Pit0.png**, **Objects/Pit1.png**
- **Objects/Tile.png**
- **Objects/Tree0.png**, **Objects/Tree1.png**
- **Objects/Decor0.png**, **Objects/Decor1.png**
- **Objects/Map0.png**, **Objects/Map1.png**
- **Objects/Ore0.png**, **Objects/Ore1.png**

### Doors, traps, structures
- **Objects/Door0.png**, **Objects/Door1.png**
- **Objects/Trap0.png**, **Objects/Trap1.png**
- **Objects/Fence.png**
- **Objects/Effect0.png**, **Objects/Effect1.png**

### Characters (monsters, player)
- **Characters/Player0.png**, **Characters/Player1.png** — player
- **Characters/Humanoid0.png**, **Characters/Humanoid1.png**
- **Characters/Undead0.png**, **Characters/Undead1.png**
- **Characters/Demon0.png**, **Characters/Demon1.png**
- **Characters/Aquatic0.png**, **Characters/Aquatic1.png**
- **Characters/Avian0.png**, **Characters/Avian1.png**
- **Characters/Elemental0.png**, **Characters/Elemental1.png**
- **Characters/Plant0.png**, **Characters/Plant1.png**
- **Characters/Slime0.png**, **Characters/Slime1.png**
- **Characters/Reptile0.png**, **Characters/Reptile1.png**
- **Characters/Rodent0.png**, **Characters/Rodent1.png**
- **Characters/Quadraped0.png**, **Characters/Quadraped1.png**
- **Characters/Pest0.png**, **Characters/Pest1.png**
- **Characters/Cat0.png**, **Characters/Cat1.png**
- **Characters/Dog0.png**, **Characters/Dog1.png**
- **Characters/Misc0.png**, **Characters/Misc1.png**

### Items
- **Items/Potion.png**, **Items/Scroll.png**, **Items/Book.png**
- **Items/Amulet.png**, **Items/Ring.png**
- **Items/Armor.png**, **Items/Boot.png**, **Items/Glove.png**, **Items/Hat.png**
- **Items/ShortWep.png**, **Items/MedWep.png**, **Items/LongWep.png**
- **Items/Shield.png**, **Items/Wand.png**
- **Items/Food.png**, **Items/Money.png**, **Items/Key.png**
- **Items/Chest0.png**, **Items/Chest1.png**
- **Items/Light.png**, **Items/Tool.png**, **Items/Rock.png**, **Items/Ammo.png**
- **Items/Flesh.png**, **Items/Music.png**

### GUI (sidebar / UI — optional for smoke test)
- **GUI/GUI0.png**, **GUI/GUI1.png**
- **GUI/SDS_6x6.ttf**, **GUI/SDS_8x8.ttf** — pixel fonts

## Mapping to Brogue glyph categories

| Brogue category   | DawnLike sheets to use first        |
|-------------------|-------------------------------------|
| Floor / terrain   | Objects/Floor, Objects/Ground0, Ground1 |
| Walls             | Objects/Wall                        |
| Doors             | Objects/Door0, Door1                |
| Stairs / pits     | Objects/Pit0, Pit1, decor/traps     |
| Player            | Characters/Player0 (or Player1)     |
| Monsters          | Characters/* by creature type       |
| Items             | Items/* by item type                |

Phase 2 will define a concrete `DisplayGlyph` → `{ sheet, srcX, srcY }` table; this catalog identifies which PNGs to pull from.
