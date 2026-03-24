"""Generate a debug autotile spritesheet with variant index numbers.

128×96 PNG (8 cols × 6 rows of 16×16 tiles). Each cell shows its variant
index (0–46) so the autotile system's variant selection is instantly
visible in-game. Slot 47 (bottom-right) is left blank.

Also encodes the connectivity pattern: colored edges/corners indicate
which neighbors are connected for that variant's canonical bitmask.
"""

from PIL import Image, ImageDraw, ImageFont
import sys
import os

TILE = 16
COLS = 8
ROWS = 6
WIDTH = COLS * TILE
HEIGHT = ROWS * TILE

# From autotile.ts — the 47 canonical bitmask values, sorted ascending.
VARIANT_CANONICAL_MASKS = [
    0, 1, 4, 5, 7, 16, 17, 20, 21, 23,
    28, 29, 31, 64, 65, 68, 69, 71, 80, 81,
    84, 85, 87, 92, 93, 95, 112, 113, 116, 117,
    119, 124, 125, 127, 193, 197, 199, 209, 213, 215,
    221, 223, 241, 245, 247, 253, 255,
]

# Bit positions: N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7
# Neighbor offsets in the 3×3 grid (col, row) for each bit
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

CONNECTED_COLOR = (100, 180, 255, 200)    # blue-ish for connected
DISCONNECTED_COLOR = (40, 35, 40, 120)    # dark for not connected
CENTER_COLOR = (220, 180, 60, 255)        # gold for self
TEXT_COLOR = (255, 255, 255, 255)
BG_COLOR = (0, 0, 0, 0)                  # transparent

def draw_variant(draw: ImageDraw.ImageDraw, variant_idx: int, ox: int, oy: int):
    mask = VARIANT_CANONICAL_MASKS[variant_idx]
    cell = TILE // 3  # ~5px per sub-cell

    for bit, (gc, gr) in BIT_POSITIONS.items():
        connected = (mask & (1 << bit)) != 0
        color = CONNECTED_COLOR if connected else DISCONNECTED_COLOR
        x0 = ox + gc * cell
        y0 = oy + gr * cell
        x1 = x0 + cell - 1
        y1 = y0 + cell - 1
        draw.rectangle([x0, y0, x1, y1], fill=color)

    # Center cell (self)
    cx0 = ox + 1 * cell
    cy0 = oy + 1 * cell
    draw.rectangle([cx0, cy0, cx0 + cell - 1, cy0 + cell - 1], fill=CENTER_COLOR)

    # Draw variant index number
    text = str(variant_idx)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 8)
    except (OSError, IOError):
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = ox + (TILE - tw) // 2
    ty = oy + (TILE - th) // 2 - 1
    # Dark outline for readability
    for ddx in (-1, 0, 1):
        for ddy in (-1, 0, 1):
            if ddx or ddy:
                draw.text((tx + ddx, ty + ddy), text, fill=(0, 0, 0, 255), font=font)
    draw.text((tx, ty), text, fill=TEXT_COLOR, font=font)


def main():
    out_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "rogue-ts", "assets", "tilesets", "autotile", "wall-autotile.png",
    )

    img = Image.new("RGBA", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    for idx in range(47):
        col = idx % COLS
        row = idx // COLS
        ox = col * TILE
        oy = row * TILE
        draw_variant(draw, idx, ox, oy)

    img.save(out_path, "PNG")
    print(f"Wrote {out_path} ({WIDTH}×{HEIGHT})")


if __name__ == "__main__":
    main()
