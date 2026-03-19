# Pixel Art Pipeline — Plan

## Approach

Two standalone scripts and a set of supporting text files. No framework, no dependencies beyond the Python libraries below. The pipeline is intentionally linear and manual-step-friendly — it produces artifacts a human reviews at each stage rather than running end-to-end unattended.

```
items.txt + template.txt
        ↓
  generate_prompts.py → prompts.txt       (automated)
        ↓
  Midjourney web UI                        (manual — download to input/)
        ↓
  process_images.py → output/             (automated)
        ↓
  Aseprite cleanup                         (manual)
```

## Technical Notes

### Prompt Generation (`generate_prompts.py`)
- Reads `items.txt` — one asset name per line
- Reads `template.txt` — contains the full base style prompt with `{item}` as the interpolation token
- Outputs `prompts.txt` — one ready-to-paste Midjourney prompt per line, labeled with the item name
- `template.txt` is the living record of the tested style — update it as the aesthetic gets refined, not the script

**Template format example:**
```
pixel art sprite, {item}, 32x32, dark fantasy, Castlevania NES sprite style, 
Capcom CPS2 arcade, hard masculine features, realistic proportions, 
no oversized head, muted dark palette, 16 colors, hard pixel edges, 
no anti-aliasing, full body, black background, 
Mike Mignola influence --ar 1:1 --style raw --v 6
--no anime, chibi, cute, kawaii, big eyes, soft, pastel
```

### Image Post-Processing (`process_images.py`)
Processes all PNGs in `input/` and writes results to `output/`. Three sequential steps per image:

1. **Background removal** — `rembg` library. Handles dark-on-dark better than color selection. Outputs RGBA PNG.
2. **Downscale to 32x32** — ImageMagick via subprocess, `point` filter (nearest-neighbor). Must use nearest-neighbor; any other interpolation destroys pixel edges.
3. **Palette reduction** — Pillow `quantize(colors=16)` on the RGB channels, alpha channel separated and reattached. Collapses AI's hundreds of near-identical colors into an intentional limited palette.

### Directory Layout
```
pixel-art-pipeline/
├── items.txt               # one asset name per line
├── template.txt            # base style prompt with {item} token
├── generate_prompts.py
├── process_images.py
├── input/                  # drop downloaded MJ PNGs here
├── output/                 # processed PNGs land here, ready for Aseprite
└── requirements.txt        # rembg, Pillow
```

### Dependencies
- `rembg` — background removal
- `Pillow` — palette quantization
- `ImageMagick` — must be installed system-wide (`magick` on PATH)

## Open Questions
- Should palette reduction step use a fixed reference palette (e.g. DawnBringer DB16) rather than auto-quantize? Would produce more consistent cross-asset color harmony. Deferred until we have enough sprites to evaluate.
- Worth adding an optional `--size` flag to `process_images.py` for non-32x32 targets?
