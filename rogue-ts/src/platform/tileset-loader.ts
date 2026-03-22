/*
 *  tileset-loader.ts — Load DawnLike 16×16 tileset PNGs for pixel-art rendering
 *  Pixel-art smoke test — Initiative: initiatives/pixel-art-smoke-test
 *
 *  Uses static imports so Vite resolves and serves the assets. Glyph-to-sprite
 *  mapping is in glyph-sprite-map.ts.
 */

import FloorUrl from "../../assets/tilesets/dawnlike/Objects/Floor.png?url";
import WallUrl from "../../assets/tilesets/dawnlike/Objects/Wall.png?url";
import Door0Url from "../../assets/tilesets/dawnlike/Objects/Door0.png?url";
import Door1Url from "../../assets/tilesets/dawnlike/Objects/Door1.png?url";
import Ground0Url from "../../assets/tilesets/dawnlike/Objects/Ground0.png?url";
import Player0Url from "../../assets/tilesets/dawnlike/Characters/Player0.png?url";
import Rodent0Url from "../../assets/tilesets/dawnlike/Characters/Rodent0.png?url";
import Humanoid1Url from "../../assets/tilesets/dawnlike/Characters/Humanoid1.png?url";
import Quadraped0Url from "../../assets/tilesets/dawnlike/Characters/Quadraped0.png?url";
import Undead1Url from "../../assets/tilesets/dawnlike/Characters/Undead1.png?url";
import Demon1Url from "../../assets/tilesets/dawnlike/Characters/Demon1.png?url";
import Reptile1Url from "../../assets/tilesets/dawnlike/Characters/Reptile1.png?url";
import Rodent1Url from "../../assets/tilesets/dawnlike/Characters/Rodent1.png?url";
import Pest0Url from "../../assets/tilesets/dawnlike/Characters/Pest0.png?url";
import Cat0Url from "../../assets/tilesets/dawnlike/Characters/Cat0.png?url";
import Dog0Url from "../../assets/tilesets/dawnlike/Characters/Dog0.png?url";
import TileUrl from "../../assets/tilesets/dawnlike/Objects/Tile.png?url";
import Pit1Url from "../../assets/tilesets/dawnlike/Objects/Pit1.png?url";
import Decor0Url from "../../assets/tilesets/dawnlike/Objects/Decor0.png?url";
import Effect0Url from "../../assets/tilesets/dawnlike/Objects/Effect0.png?url";
import Trap0Url from "../../assets/tilesets/dawnlike/Objects/Trap0.png?url";
import GUI_0Url from "../../assets/tilesets/dawnlike/GUI/GUI0.png?url";
import TheRoguelikeUrl from "../../assets/tilesets/the-roguelike/the-roguelike.png?url";
import DemonicDungeonUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Full.png?url";
import DemonicDungeonDungeonUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Dungeon.png?url";
import DemonicDungeonCaveUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Cave.png?url";
import DemonicDungeonMonstersUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Monsters.png?url";
import DemonicDungeonHeroesUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Heroes.png?url";
import DemonicDungeonItemsUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Items.png?url";
import DemonicDungeonGenericsUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Generics.png?url";
import DemonicDungeonParticlesUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Particles.png?url";
import DemonicDungeonWaterUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Water.png?url";
import DemonicDungeonBackgroundUrl from "../../assets/tilesets/DemonicDungeon/No-Background/Background.png?url";
import DemonicDungeonAridUrl from "../../assets/tilesets/DemonicDungeon/arid/No-Background/Full.png?url";
import DemonicDungeonFrozenUrl from "../../assets/tilesets/DemonicDungeon/frozen/No-Background/Full.png?url";
import DemonicDungeonHauntedUrl from "../../assets/tilesets/DemonicDungeon/haunted/No-Background/Full.png?url";
import DemonicDungeonInteriorUrl from "../../assets/tilesets/DemonicDungeon/interior/No-Background/Full.png?url";
import RavenIconsDarkUrl from "../../assets/tilesets/raven/icons_dark.png?url";
import RavenPotionsUrl from "../../assets/tilesets/raven/potions.png?url";

const SHEET_URLS: Record<string, string> = {
  Floor: FloorUrl,
  Wall: WallUrl,
  Door0: Door0Url,
  Door1: Door1Url,
  Ground0: Ground0Url,
  Player0: Player0Url,
  Tile: TileUrl,
  Pit1: Pit1Url,
  Decor0: Decor0Url,
  Effect0: Effect0Url,
  Trap0: Trap0Url,
  GUI0: GUI_0Url,
  TheRoguelike: TheRoguelikeUrl,
  DD_Full: DemonicDungeonUrl,
  DD_Dungeon: DemonicDungeonDungeonUrl,
  DD_Cave: DemonicDungeonCaveUrl,
  DD_Monsters: DemonicDungeonMonstersUrl,
  DD_Heroes: DemonicDungeonHeroesUrl,
  DD_Items: DemonicDungeonItemsUrl,
  DD_Generics: DemonicDungeonGenericsUrl,
  DD_Particles: DemonicDungeonParticlesUrl,
  DD_Water: DemonicDungeonWaterUrl,
  DD_Background: DemonicDungeonBackgroundUrl,
  DD_Arid: DemonicDungeonAridUrl,
  DD_Frozen: DemonicDungeonFrozenUrl,
  DD_Haunted: DemonicDungeonHauntedUrl,
  DD_Interior: DemonicDungeonInteriorUrl,
  Raven_Icons: RavenIconsDarkUrl,
  Raven_Potions: RavenPotionsUrl,
  Rodent0: Rodent0Url,
  Humanoid1: Humanoid1Url,
  Undead1: Undead1Url,
  Quadraped0: Quadraped0Url,
  Demon1: Demon1Url,
  Reptile1: Reptile1Url,
  Rodent1: Rodent1Url,
  Pest0: Pest0Url,
  Cat0: Cat0Url,
  Dog0: Dog0Url,
};

export const TILE_SIZE = 16;

/**
 * Load all tileset images. Resolves when every image has loaded.
 * Keys are sheet names (e.g. "Floor", "Wall"). Fails if any image fails to load.
 */
export function loadTilesetImages(): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const entries = Object.entries(SHEET_URLS);

  return Promise.all(
    entries.map(([name, url]) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          map.set(name, img);
          resolve();
        };
        img.onerror = () =>
          reject(new Error(`Failed to load tileset: ${name} (${url})`));
        img.src = url;
      });
    }),
  ).then(() => map);
}
