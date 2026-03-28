"""Generate a Wang Blob autotile template PNG.

Produces a 7x7 grid at a configurable tile size (default 16x16, matching
the game's pixel-art pipeline). Each cell shows its variant index number
and a mini connectivity diagram so the artist knows what shape to draw.

The Wang Blob layout places connected variants adjacent to each other,
making the sheet natural to paint on — surrounding terrain "flows" as if
the artist were drawing the terrain itself.

Empty corners at grid positions (6,0) and (6,6) are drawn as dark cells
with an "X" to indicate they should be left empty.

Usage:
    python tools/gen-wang-blob-template.py                     # 16x16 default
    python tools/gen-wang-blob-template.py --tile-size 32      # 32x32
    python tools/gen-wang-blob-template.py -o my-template.png  # custom output
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont

WANG_BLOB_GRID = [
    [  0,   4,  92, 124, 116,  80,   0],
    [ 16,  20,  87, 223, 241,  21,  64],
    [ 29, 117,  85,  71, 221, 125, 112],
    [ 31, 253, 113,  28, 127, 247, 209],
    [ 23, 199, 213,  95, 255, 245,  81],
    [  5,  84,  93, 119, 215, 193,  17],
    [  0,   1,   7, 197,  69,  68,  65],
]

VARIANT_CANONICAL_MASKS = [
    0, 1, 4, 5, 7, 16, 17, 20, 21, 23,
    28, 29, 31, 64, 65, 68, 69, 71, 80, 81,
    84, 85, 87, 92, 93, 95, 112, 113, 116, 117,
    119, 124, 125, 127, 193, 197, 199, 209, 213, 215,
    221, 223, 241, 245, 247, 253, 255,
]

MASK_TO_VARIANT = {m: i for i, m in enumerate(VARIANT_CANONICAL_MASKS)}

EMPTY_CORNERS = {(6, 0), (0, 6)}

COLS = 7
ROWS = 7

BIT_POSITIONS = {
    0: (1, 0),  # N
    1: (2, 0),  # NE
    2: (2, 1),  # E
    3: (2, 2),  # SE
    4: (1, 2),  # S
    5: (0, 2),  # SW
    6: (0, 1),  # W
    7: (0, 0),  # NW
}

CONNECTED_COLOR = (100, 180, 255, 200)
DISCONNECTED_COLOR = (40, 35, 40, 120)
CENTER_COLOR = (220, 180, 60, 255)
EMPTY_BG_COLOR = (25, 20, 25, 180)
TEXT_COLOR = (255, 255, 255, 255)
EMPTY_X_COLOR = (120, 60, 60, 200)
BG_COLOR = (0, 0, 0, 0)


def get_font(tile_size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_size = max(7, tile_size // 2)
    try:
        return ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", font_size)
    except (OSError, IOError):
        pass
    for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
                 "/usr/share/fonts/TTF/DejaVuSansMono.ttf"]:
        try:
            return ImageFont.truetype(path, font_size)
        except (OSError, IOError):
            pass
    return ImageFont.load_default()


def draw_variant(draw: ImageDraw.ImageDraw, mask: int, variant_idx: int,
                 ox: int, oy: int, tile: int, font: ImageFont.FreeTypeFont):
    cell = tile // 3

    for bit, (gc, gr) in BIT_POSITIONS.items():
        connected = (mask & (1 << bit)) != 0
        color = CONNECTED_COLOR if connected else DISCONNECTED_COLOR
        x0 = ox + gc * cell
        y0 = oy + gr * cell
        x1 = x0 + cell - 1
        y1 = y0 + cell - 1
        draw.rectangle([x0, y0, x1, y1], fill=color)

    cx0 = ox + 1 * cell
    cy0 = oy + 1 * cell
    draw.rectangle([cx0, cy0, cx0 + cell - 1, cy0 + cell - 1], fill=CENTER_COLOR)

    text = str(variant_idx)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = ox + (tile - tw) // 2
    ty = oy + (tile - th) // 2 - 1

    for ddx in (-1, 0, 1):
        for ddy in (-1, 0, 1):
            if ddx or ddy:
                draw.text((tx + ddx, ty + ddy), text, fill=(0, 0, 0, 255), font=font)
    draw.text((tx, ty), text, fill=TEXT_COLOR, font=font)


def draw_empty(draw: ImageDraw.ImageDraw, ox: int, oy: int, tile: int):
    draw.rectangle([ox, oy, ox + tile - 1, oy + tile - 1], fill=EMPTY_BG_COLOR)
    margin = max(2, tile // 6)
    draw.line([(ox + margin, oy + margin), (ox + tile - margin, oy + tile - margin)],
              fill=EMPTY_X_COLOR, width=max(1, tile // 8))
    draw.line([(ox + tile - margin, oy + margin), (ox + margin, oy + tile - margin)],
              fill=EMPTY_X_COLOR, width=max(1, tile // 8))


def main():
    parser = argparse.ArgumentParser(description="Generate a Wang Blob autotile template PNG")
    parser.add_argument("--tile-size", "-t", type=int, default=16,
                        help="Tile size in pixels (default: 16)")
    parser.add_argument("-o", "--output", type=str, default=None,
                        help="Output path (default: rogue-ts/assets/tilesets/raw-autotile/wang-blob-template-{size}.png)")
    args = parser.parse_args()

    tile = args.tile_size
    width = COLS * tile
    height = ROWS * tile

    if args.output:
        out_path = args.output
    else:
        out_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "rogue-ts", "assets", "tilesets", "raw-autotile",
            f"wang-blob-template-{tile}x{tile}.png",
        )

    img = Image.new("RGBA", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)
    font = get_font(tile)

    for row in range(ROWS):
        for col in range(COLS):
            ox = col * tile
            oy = row * tile
            if (col, row) in EMPTY_CORNERS:
                draw_empty(draw, ox, oy, tile)
            else:
                mask = WANG_BLOB_GRID[row][col]
                variant_idx = MASK_TO_VARIANT[mask]
                draw_variant(draw, mask, variant_idx, ox, oy, tile, font)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG")
    print(f"Wrote {out_path} ({width}×{height}, tile={tile}×{tile})")


if __name__ == "__main__":
    main()
