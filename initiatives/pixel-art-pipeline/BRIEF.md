# Pixel Art Pipeline

## Intent
Build a lightweight pipeline to generate dark fantasy pixel art sprites and assets for use in a game project. Midjourney handles image generation (manually via web UI); scripting handles prompt generation and image post-processing.

## Goals
- A tested base style prompt that produces consistent dark fantasy, non-anime, western game art aesthetic across all assets
- A script that takes a list of asset names and produces ready-to-use Midjourney prompts
- A script that takes a folder of downloaded Midjourney PNGs and outputs clean 32x32 palette-reduced transparent PNGs ready for Aseprite cleanup
- A repeatable process that can produce new assets with minimal friction per asset

## Scope
What's in:
- Prompt template system (base style + per-item interpolation)
- Automated post-processing: background removal (rembg), downscaling to 32x32 (ImageMagick), palette reduction to 16 colors (Pillow)
- Output ready for manual Aseprite cleanup pass

What's out:
- Any automation of Midjourney itself (web UI only, no unofficial APIs)
- Automated Aseprite cleanup — this stays manual, it's the craft step
- Animation or sprite sheets (out of scope for now)
- Any game engine integration

## Constraints
- Midjourney web UI is the only generation interface — no API automation
- Output must be PNG with transparency
- Target resolution: 32x32 (revisit if assets need more detail)
- Toolchain: Python for post-processing scripts, TypeScript optional for prompt generation
