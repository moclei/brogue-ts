# Pixel Art Pipeline — Tasks

## Phase 1: Prompt System
- [ ] Create `items.txt` with initial asset list (start with ~5 test items)
- [ ] Write `template.txt` with current best-known style prompt — use tested language from Midjourney sessions so far
- [ ] Write `generate_prompts.py` — reads items + template, outputs labeled `prompts.txt`
- [ ] Test: run against items list, manually paste a few prompts into Midjourney and verify output quality

## Phase 2: Post-Processing Script
- [ ] Set up `requirements.txt` with `rembg` and `Pillow`
- [ ] Create `input/` and `output/` directories
- [ ] Write `process_images.py` — background removal via rembg
- [ ] Add downscale step — ImageMagick `point` filter to 32x32
- [ ] Add palette reduction step — Pillow quantize to 16 colors with alpha reattachment
- [ ] Test full pipeline on the rogue character sprite from Midjourney sessions
- [ ] Verify output looks correct before Aseprite cleanup step

## Phase 3: Refinement
- [ ] Refine `template.txt` based on any prompt testing learnings
- [ ] Document any per-category prompt variations needed (e.g. characters vs. environment tiles vs. items behave differently)
- [ ] Evaluate whether DB16 fixed palette produces better cross-asset consistency than auto-quantize
