/*
 *  sprite-debug.ts — Runtime debug overlay for the layer compositing pipeline
 *  brogue-ts
 *
 *  Singleton config object + floating HTML panel (F2 toggle).
 *  The SpriteRenderer reads `spriteDebug` each frame to apply per-layer
 *  overrides (visibility, tint, alpha, blend mode) and optionally skip
 *  the post-compositing visibility overlay.
 *
 *  Cell inspection: click a dungeon cell while the panel is open to see
 *  the actual per-layer tint values the renderer is using.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { RENDER_LAYER_COUNT } from "./render-layers.js";
import { BITMASK_TO_VARIANT } from "./autotile.js";

// =============================================================================
// Debug config
// =============================================================================

export type BlendMode =
  | "none"
  | "multiply"
  | "source-over"
  | "screen"
  | "overlay"
  | "color-dodge"
  | "color-burn";

const ALL_BLEND_MODES: BlendMode[] = [
  "none", "multiply", "source-over", "screen", "overlay", "color-dodge", "color-burn",
];

export interface LayerOverride {
  visible: boolean;
  /** RGB 0-255 + optional alpha 0-1 for the tint fill itself. */
  tintOverride: { r: number; g: number; b: number; a: number } | null;
  alphaOverride: number | null;
  blendMode: BlendMode | null;
}

/** Snapshot of one layer's actual tint/alpha as seen by the renderer. */
export interface InspectedLayerData {
  tintR: number; tintG: number; tintB: number;
  alpha: number | undefined;
  adjacencyMask?: number;
  variantIndex?: number;
  connectionGroup?: string;
}

function defaultLayerOverride(): LayerOverride {
  return { visible: true, tintOverride: null, alphaOverride: null, blendMode: null };
}

export interface SpriteDebugConfig {
  enabled: boolean;
  layers: LayerOverride[];
  visibilityOverlayEnabled: boolean;
  /** Override the per-cell bgColor fill (drawn behind all layers). null = use game value. */
  bgColorOverride: { r: number; g: number; b: number } | null;
  dirty: boolean;

  /** Transient: set by plotChar before drawCellLayers so the renderer can match. */
  _renderingX: number;
  _renderingY: number;

  /** Dungeon cell the user clicked for inspection, or null. */
  inspectTarget: { x: number; y: number } | null;

  /** Per-layer tint/alpha snapshot from the last inspected cell. */
  inspectedLayers: (InspectedLayerData | null)[];

  /** Called by the renderer after snapshotting a matching cell. */
  onInspect: (() => void) | null;

  /** When true, the renderer draws the autotile variant index on each cell. */
  showVariantIndices: boolean;
}

function createDefaultConfig(): SpriteDebugConfig {
  const layers: LayerOverride[] = [];
  const inspectedLayers: (InspectedLayerData | null)[] = [];
  for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
    layers.push(defaultLayerOverride());
    inspectedLayers.push(null);
  }
  return {
    enabled: false, layers, visibilityOverlayEnabled: true,
    bgColorOverride: null, dirty: false,
    _renderingX: -1, _renderingY: -1,
    inspectTarget: null, inspectedLayers, onInspect: null, showVariantIndices: false,
  };
}

export const spriteDebug: SpriteDebugConfig = createDefaultConfig();

export function resetSpriteDebug(): void {
  for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
    const lo = spriteDebug.layers[i];
    lo.visible = true;
    lo.tintOverride = null;
    lo.alphaOverride = null;
    lo.blendMode = null;
    spriteDebug.inspectedLayers[i] = null;
  }
  spriteDebug.visibilityOverlayEnabled = true;
  spriteDebug.bgColorOverride = null;
  spriteDebug.inspectTarget = null;
  spriteDebug.showVariantIndices = false;
  spriteDebug.dirty = true;
}

// =============================================================================
// Helpers
// =============================================================================

const LAYER_NAMES: string[] = [
  "TERRAIN", "LIQUID", "SURFACE", "ITEM", "ENTITY", "GAS",
  "FIRE", "VISIBILITY", "STATUS", "BOLT", "UI",
];

let panelEl: HTMLElement | null = null;

function markDirty(): void { spriteDebug.dirty = true; }

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Brogue 0-100 color scale → 0-255 */
function c100to255(v: number): number {
  return Math.min(255, Math.max(0, Math.round((v * 255) / 100)));
}

function rgbHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// =============================================================================
// Panel DOM — per-layer row
// =============================================================================

/** Stored references to the "actual tint" swatch elements, one per layer. */
const actualSwatches: HTMLElement[] = [];

function createLayerRow(container: HTMLElement, index: number): void {
  const lo = spriteDebug.layers[index];
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = lo.visible;
  cb.style.cssText = "margin:0;cursor:pointer;";
  cb.addEventListener("change", () => { lo.visible = cb.checked; markDirty(); });
  row.appendChild(cb);

  const label = document.createElement("span");
  label.textContent = LAYER_NAMES[index];
  label.style.cssText = "width:72px;font-family:monospace;color:#ccc;";
  row.appendChild(label);

  // Actual-tint swatch (read-only, populated on cell click)
  const swatch = document.createElement("span");
  swatch.title = "Actual tint (click cell to inspect)";
  swatch.style.cssText =
    "display:inline-block;width:16px;height:16px;border:1px solid #444;" +
    "border-radius:2px;background:#000;flex-shrink:0;";
  row.appendChild(swatch);
  actualSwatches[index] = swatch;

  // Tint override: checkbox + color picker + alpha slider
  const tintWrap = document.createElement("div");
  tintWrap.style.cssText = "display:flex;align-items:center;gap:2px;";
  const tintCb = document.createElement("input");
  tintCb.type = "checkbox";
  tintCb.checked = false;
  tintCb.style.cssText = "margin:0;cursor:pointer;";
  const tintPicker = document.createElement("input");
  tintPicker.type = "color";
  tintPicker.value = "#ffffff";
  tintPicker.disabled = true;
  tintPicker.style.cssText =
    "width:24px;height:18px;padding:0;border:1px solid #555;cursor:pointer;background:transparent;";
  const tintAlpha = document.createElement("input");
  tintAlpha.type = "range";
  tintAlpha.min = "0";
  tintAlpha.max = "100";
  tintAlpha.value = "100";
  tintAlpha.disabled = true;
  tintAlpha.title = "Tint opacity";
  tintAlpha.style.cssText = "width:36px;cursor:pointer;accent-color:#fa0;";

  function syncTintOverride(): void {
    if (!tintCb.checked) { lo.tintOverride = null; markDirty(); return; }
    const rgb = hexToRgb(tintPicker.value);
    lo.tintOverride = { ...rgb, a: parseInt(tintAlpha.value, 10) / 100 };
    markDirty();
  }
  tintCb.addEventListener("change", () => {
    tintPicker.disabled = !tintCb.checked;
    tintAlpha.disabled = !tintCb.checked;
    syncTintOverride();
  });
  tintPicker.addEventListener("input", syncTintOverride);
  tintAlpha.addEventListener("input", syncTintOverride);
  tintWrap.appendChild(tintCb);
  tintWrap.appendChild(tintPicker);
  tintWrap.appendChild(tintAlpha);
  row.appendChild(tintWrap);

  const alphaLabel = document.createElement("span");
  alphaLabel.textContent = "α";
  alphaLabel.style.cssText = "color:#888;font-size:10px;";
  row.appendChild(alphaLabel);

  const alphaSlider = document.createElement("input");
  alphaSlider.type = "range";
  alphaSlider.min = "0";
  alphaSlider.max = "100";
  alphaSlider.value = "100";
  alphaSlider.style.cssText = "width:60px;cursor:pointer;accent-color:#6cf;";
  const alphaVal = document.createElement("span");
  alphaVal.textContent = "—";
  alphaVal.style.cssText = "width:28px;color:#aaa;font-size:10px;text-align:right;";

  alphaSlider.addEventListener("input", () => {
    const v = parseInt(alphaSlider.value, 10);
    lo.alphaOverride = v / 100;
    alphaVal.textContent = (v / 100).toFixed(2);
    markDirty();
  });
  row.appendChild(alphaSlider);
  row.appendChild(alphaVal);

  const blendSel = document.createElement("select");
  blendSel.style.cssText =
    "font-size:10px;background:#222;color:#ccc;border:1px solid #555;" +
    "padding:1px 2px;cursor:pointer;";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "default";
  blendSel.appendChild(defaultOpt);
  for (const mode of ALL_BLEND_MODES) {
    const opt = document.createElement("option");
    opt.value = mode;
    opt.textContent = mode;
    blendSel.appendChild(opt);
  }
  blendSel.addEventListener("change", () => {
    lo.blendMode = blendSel.value ? (blendSel.value as BlendMode) : null;
    markDirty();
  });
  row.appendChild(blendSel);

  container.appendChild(row);
}

// =============================================================================
// Panel DOM — main builder
// =============================================================================

/** Inspected-cell coordinate display element (updated by onInspect callback). */
let inspectLabel: HTMLElement | null = null;
/** Container for autotile info (bitmask, variant, group, 3x3 grid). */
let autotileInfoEl: HTMLElement | null = null;

/** Render a 3×3 mini-grid showing which neighbors are connected. */
function renderNeighborGrid(mask: number): string {
  const on = (bit: number) => (mask & (1 << bit)) !== 0;
  const c = (bit: number) => on(bit) ? "█" : "·";
  return `${c(7)} ${c(0)} ${c(1)}\n${c(6)}  X  ${c(2)}\n${c(5)} ${c(4)} ${c(3)}`;
}

function updateAutotileInfo(): void {
  if (!autotileInfoEl) return;
  let found = false;
  for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
    const data = spriteDebug.inspectedLayers[i];
    if (data?.adjacencyMask !== undefined) {
      found = true;
      break;
    }
  }
  if (!found) {
    autotileInfoEl.style.display = "none";
    return;
  }
  autotileInfoEl.style.display = "block";
  let html = "";
  for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
    const data = spriteDebug.inspectedLayers[i];
    if (!data || data.adjacencyMask === undefined) continue;
    const mask = data.adjacencyMask;
    const variant = data.variantIndex ?? BITMASK_TO_VARIANT[mask];
    const group = data.connectionGroup ?? "—";
    const binary = mask.toString(2).padStart(8, "0");
    html += `<div style="margin-bottom:4px;">`;
    html += `<span style="color:#6cf;">${LAYER_NAMES[i]}</span> `;
    html += `<span style="color:#fa0;">group:</span> ${group}`;
    html += `<br><span style="color:#fa0;">mask:</span> <span style="font-family:monospace;">${binary}</span>`;
    html += ` <span style="color:#888;">(${mask})</span>`;
    html += ` <span style="color:#fa0;">var:</span> ${variant}`;
    html += `<pre style="margin:2px 0 0;line-height:1.2;color:#aaa;">${renderNeighborGrid(mask)}</pre>`;
    html += `</div>`;
  }
  autotileInfoEl.innerHTML = html;
}

function updateInspectDisplay(): void {
  const t = spriteDebug.inspectTarget;
  if (inspectLabel) {
    inspectLabel.textContent = t ? `Cell (${t.x}, ${t.y})` : "Click a cell to inspect";
  }
  for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
    const data = spriteDebug.inspectedLayers[i];
    const sw = actualSwatches[i];
    if (!sw) continue;
    if (data) {
      const r = c100to255(data.tintR);
      const g = c100to255(data.tintG);
      const b = c100to255(data.tintB);
      sw.style.background = rgbHex(r, g, b);
      const a = data.alpha !== undefined ? ` α${data.alpha.toFixed(2)}` : "";
      sw.title = `rgb(${r},${g},${b})${a}`;
    } else {
      sw.style.background = "#000";
      sw.title = "— (empty layer)";
    }
  }
  updateAutotileInfo();
}

export function toggleDebugPanel(parentEl: HTMLElement): boolean {
  if (panelEl) {
    const showing = panelEl.style.display === "none";
    panelEl.style.display = showing ? "block" : "none";
    spriteDebug.enabled = showing;
    if (showing) spriteDebug.dirty = true;
    return showing;
  }

  spriteDebug.enabled = true;

  panelEl = document.createElement("div");
  panelEl.style.cssText =
    "position:absolute;top:8px;right:8px;z-index:9999;" +
    "background:rgba(15,15,20,0.92);border:1px solid #444;border-radius:6px;" +
    "padding:10px 12px;color:#ddd;font-family:system-ui,sans-serif;" +
    "font-size:12px;pointer-events:auto;user-select:none;" +
    "box-shadow:0 4px 20px rgba(0,0,0,0.6);max-height:90vh;overflow-y:auto;";

  // Header
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;" +
    "margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px;";
  const title = document.createElement("span");
  title.textContent = "Sprite Layer Debug";
  title.style.cssText = "font-weight:600;font-size:13px;color:#6cf;";
  header.appendChild(title);
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText =
    "background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:0 4px;";
  closeBtn.addEventListener("click", () => {
    if (panelEl) panelEl.style.display = "none";
    spriteDebug.enabled = false;
  });
  header.appendChild(closeBtn);
  panelEl.appendChild(header);

  // Inspected cell info bar
  inspectLabel = document.createElement("div");
  inspectLabel.textContent = "Click a cell to inspect";
  inspectLabel.style.cssText =
    "font-size:10px;color:#888;margin-bottom:6px;font-style:italic;";
  panelEl.appendChild(inspectLabel);

  // Layer rows
  for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
    createLayerRow(panelEl, i);
  }

  // Autotile info section (populated on cell inspect)
  autotileInfoEl = document.createElement("div");
  autotileInfoEl.style.cssText =
    "display:none;margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.3);" +
    "border:1px solid #333;border-radius:4px;font-size:10px;font-family:monospace;color:#ccc;";
  panelEl.appendChild(autotileInfoEl);

  // Separator
  const sep = document.createElement("div");
  sep.style.cssText = "border-top:1px solid #333;margin:8px 0;";
  panelEl.appendChild(sep);

  // Visibility overlay toggle
  const visRow = document.createElement("div");
  visRow.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;";
  const visCb = document.createElement("input");
  visCb.type = "checkbox";
  visCb.checked = spriteDebug.visibilityOverlayEnabled;
  visCb.style.cssText = "margin:0;cursor:pointer;";
  visCb.addEventListener("change", () => {
    spriteDebug.visibilityOverlayEnabled = visCb.checked;
    markDirty();
  });
  const visLabel = document.createElement("span");
  visLabel.textContent = "Visibility Overlay";
  visLabel.style.cssText = "color:#ccc;";
  visRow.appendChild(visCb);
  visRow.appendChild(visLabel);
  panelEl.appendChild(visRow);

  // Variant index overlay toggle
  const varRow = document.createElement("div");
  varRow.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;margin-top:4px;";
  const varCb = document.createElement("input");
  varCb.type = "checkbox";
  varCb.checked = spriteDebug.showVariantIndices;
  varCb.style.cssText = "margin:0;cursor:pointer;";
  varCb.addEventListener("change", () => {
    spriteDebug.showVariantIndices = varCb.checked;
    markDirty();
  });
  const varLabel = document.createElement("span");
  varLabel.textContent = "Show Variant Indices";
  varLabel.style.cssText = "color:#ccc;";
  varRow.appendChild(varCb);
  varRow.appendChild(varLabel);
  panelEl.appendChild(varRow);

  // Background color override
  const bgRow = document.createElement("div");
  bgRow.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;margin-top:4px;";
  const bgCb = document.createElement("input");
  bgCb.type = "checkbox";
  bgCb.checked = spriteDebug.bgColorOverride !== null;
  bgCb.style.cssText = "margin:0;cursor:pointer;";
  const bgPicker = document.createElement("input");
  bgPicker.type = "color";
  bgPicker.value = "#000000";
  bgPicker.disabled = !bgCb.checked;
  bgPicker.style.cssText =
    "width:24px;height:18px;padding:0;border:1px solid #555;cursor:pointer;background:transparent;";
  const bgLabel = document.createElement("span");
  bgLabel.textContent = "Override bgColor";
  bgLabel.style.cssText = "color:#ccc;";
  bgCb.addEventListener("change", () => {
    bgPicker.disabled = !bgCb.checked;
    spriteDebug.bgColorOverride = bgCb.checked ? hexToRgb(bgPicker.value) : null;
    markDirty();
  });
  bgPicker.addEventListener("input", () => {
    if (bgCb.checked) { spriteDebug.bgColorOverride = hexToRgb(bgPicker.value); markDirty(); }
  });
  bgRow.appendChild(bgCb);
  bgRow.appendChild(bgPicker);
  bgRow.appendChild(bgLabel);
  panelEl.appendChild(bgRow);

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset All";
  resetBtn.style.cssText =
    "margin-top:8px;width:100%;padding:4px 0;font-size:11px;" +
    "background:#333;color:#ccc;border:1px solid #555;border-radius:3px;" +
    "cursor:pointer;";
  resetBtn.addEventListener("click", () => {
    resetSpriteDebug();
    if (panelEl) { panelEl.remove(); panelEl = null; toggleDebugPanel(parentEl); }
  });
  panelEl.appendChild(resetBtn);

  const hint = document.createElement("div");
  hint.textContent = "F2 to toggle · click cell to inspect";
  hint.style.cssText = "text-align:center;color:#555;font-size:9px;margin-top:6px;";
  panelEl.appendChild(hint);

  spriteDebug.onInspect = updateInspectDisplay;

  parentEl.appendChild(panelEl);
  spriteDebug.dirty = true;
  return true;
}
