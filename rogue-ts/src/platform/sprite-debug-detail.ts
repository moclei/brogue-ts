/*
 *  sprite-debug-detail.ts — Deep-dive per-layer debug panel
 *  brogue-ts
 *
 *  Extracted from sprite-debug.ts (Phase 3) to stay under the 600-line
 *  limit. Provides Canvas2D filter, shadow, image-smoothing, and
 *  transform controls for a single layer. Opened by clicking a layer
 *  name in the overview panel; "Back" returns to the overview.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { LayerOverride } from "./sprite-debug.js";

// =============================================================================
// Helpers
// =============================================================================

const SECTION_CSS =
  "margin-bottom:8px;padding:6px 8px;background:rgba(0,0,0,0.25);" +
  "border:1px solid #333;border-radius:4px;";

function sectionLabel(text: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = "font-size:10px;color:#fa0;font-weight:600;margin-bottom:4px;";
  return el;
}

function controlRow(): HTMLElement {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px;";
  return row;
}

function labelSpan(text: string, width = "80px"): HTMLElement {
  const el = document.createElement("span");
  el.textContent = text;
  el.style.cssText = `width:${width};color:#aaa;font-size:10px;flex-shrink:0;`;
  return el;
}

function valueSpan(initial: string): HTMLElement {
  const el = document.createElement("span");
  el.textContent = initial;
  el.style.cssText = "width:40px;color:#ccc;font-size:10px;text-align:right;font-family:monospace;";
  return el;
}

// =============================================================================
// Deep-dive panel builder
// =============================================================================

export function createDeepDivePanel(
  layerIndex: number,
  layerName: string,
  lo: LayerOverride,
  onBack: () => void,
  markDirty: () => void,
): HTMLElement {
  const root = document.createElement("div");

  // Header with back button
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-bottom:10px;" +
    "border-bottom:1px solid #333;padding-bottom:6px;";
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.style.cssText =
    "background:#333;color:#ccc;border:1px solid #555;border-radius:3px;" +
    "padding:2px 8px;font-size:11px;cursor:pointer;";
  backBtn.addEventListener("click", onBack);
  header.appendChild(backBtn);
  const title = document.createElement("span");
  title.textContent = `Layer ${layerIndex}: ${layerName}`;
  title.style.cssText = "font-weight:600;font-size:13px;color:#6cf;";
  header.appendChild(title);
  root.appendChild(header);

  // ---- Filter section ----
  const filterSec = document.createElement("div");
  filterSec.style.cssText = SECTION_CSS;
  filterSec.appendChild(sectionLabel("CSS Filter"));
  const filterRow = controlRow();
  const filterInput = document.createElement("input");
  filterInput.type = "text";
  filterInput.placeholder = "e.g. blur(1px) brightness(1.5)";
  filterInput.value = lo.filterOverride ?? "";
  filterInput.style.cssText =
    "flex:1;background:#1a1a1a;color:#ccc;border:1px solid #555;border-radius:3px;" +
    "padding:3px 6px;font-size:10px;font-family:monospace;";
  filterInput.addEventListener("input", () => {
    lo.filterOverride = filterInput.value.trim() || null;
    markDirty();
  });
  filterRow.appendChild(filterInput);
  filterSec.appendChild(filterRow);

  const perfWarn = document.createElement("div");
  perfWarn.style.cssText =
    "display:none;font-size:9px;color:#f80;margin-top:2px;font-style:italic;";
  perfWarn.textContent = "⚠ CSS filters may impact per-cell performance (debug only)";
  filterSec.appendChild(perfWarn);
  (root as any)._perfWarn = perfWarn;

  root.appendChild(filterSec);

  // ---- Shadow section ----
  const shadowSec = document.createElement("div");
  shadowSec.style.cssText = SECTION_CSS;
  shadowSec.appendChild(sectionLabel("Shadow / Glow"));

  // Blur
  const blurRow = controlRow();
  blurRow.appendChild(labelSpan("Blur"));
  const blurSlider = document.createElement("input");
  blurSlider.type = "range"; blurSlider.min = "0"; blurSlider.max = "20"; blurSlider.step = "0.5";
  blurSlider.value = String(lo.shadowBlur ?? 0);
  blurSlider.style.cssText = "flex:1;cursor:pointer;accent-color:#fa0;";
  const blurVal = valueSpan(String(lo.shadowBlur ?? 0));
  blurSlider.addEventListener("input", () => {
    const v = parseFloat(blurSlider.value);
    lo.shadowBlur = v > 0 ? v : null;
    blurVal.textContent = v.toFixed(1);
    markDirty();
  });
  blurRow.appendChild(blurSlider);
  blurRow.appendChild(blurVal);
  shadowSec.appendChild(blurRow);

  // Color
  const colorRow = controlRow();
  colorRow.appendChild(labelSpan("Color"));
  const shadowPicker = document.createElement("input");
  shadowPicker.type = "color";
  shadowPicker.value = lo.shadowColor ?? "#000000";
  shadowPicker.style.cssText =
    "width:28px;height:20px;padding:0;border:1px solid #555;cursor:pointer;background:transparent;";
  shadowPicker.addEventListener("input", () => {
    lo.shadowColor = shadowPicker.value;
    markDirty();
  });
  colorRow.appendChild(shadowPicker);
  shadowSec.appendChild(colorRow);

  // Offset X
  const oxRow = controlRow();
  oxRow.appendChild(labelSpan("Offset X"));
  const oxSlider = document.createElement("input");
  oxSlider.type = "range"; oxSlider.min = "-10"; oxSlider.max = "10"; oxSlider.step = "1";
  oxSlider.value = String(lo.shadowOffsetX ?? 0);
  oxSlider.style.cssText = "flex:1;cursor:pointer;accent-color:#6cf;";
  const oxVal = valueSpan(String(lo.shadowOffsetX ?? 0));
  oxSlider.addEventListener("input", () => {
    const v = parseInt(oxSlider.value, 10);
    lo.shadowOffsetX = v !== 0 ? v : null;
    oxVal.textContent = String(v);
    markDirty();
  });
  oxRow.appendChild(oxSlider);
  oxRow.appendChild(oxVal);
  shadowSec.appendChild(oxRow);

  // Offset Y
  const oyRow = controlRow();
  oyRow.appendChild(labelSpan("Offset Y"));
  const oySlider = document.createElement("input");
  oySlider.type = "range"; oySlider.min = "-10"; oySlider.max = "10"; oySlider.step = "1";
  oySlider.value = String(lo.shadowOffsetY ?? 0);
  oySlider.style.cssText = "flex:1;cursor:pointer;accent-color:#6cf;";
  const oyVal = valueSpan(String(lo.shadowOffsetY ?? 0));
  oySlider.addEventListener("input", () => {
    const v = parseInt(oySlider.value, 10);
    lo.shadowOffsetY = v !== 0 ? v : null;
    oyVal.textContent = String(v);
    markDirty();
  });
  oyRow.appendChild(oySlider);
  oyRow.appendChild(oyVal);
  shadowSec.appendChild(oyRow);

  root.appendChild(shadowSec);

  // ---- Image smoothing section ----
  const smoothSec = document.createElement("div");
  smoothSec.style.cssText = SECTION_CSS;
  smoothSec.appendChild(sectionLabel("Rendering"));

  const smoothRow = controlRow();
  const smoothCb = document.createElement("input");
  smoothCb.type = "checkbox";
  smoothCb.checked = lo.imageSmoothingOverride ?? false;
  smoothCb.style.cssText = "margin:0;cursor:pointer;";
  smoothCb.addEventListener("change", () => {
    lo.imageSmoothingOverride = smoothCb.checked ? true : null;
    markDirty();
  });
  smoothRow.appendChild(smoothCb);
  smoothRow.appendChild(labelSpan("Image Smoothing", "auto"));
  smoothSec.appendChild(smoothRow);

  root.appendChild(smoothSec);

  // ---- Transform section ----
  const xformSec = document.createElement("div");
  xformSec.style.cssText = SECTION_CSS;
  xformSec.appendChild(sectionLabel("Transform"));

  // Flip H
  const flipRow = controlRow();
  const flipCb = document.createElement("input");
  flipCb.type = "checkbox";
  flipCb.checked = lo.flipH;
  flipCb.style.cssText = "margin:0;cursor:pointer;";
  flipCb.addEventListener("change", () => {
    lo.flipH = flipCb.checked;
    markDirty();
  });
  flipRow.appendChild(flipCb);
  flipRow.appendChild(labelSpan("Flip Horizontal", "auto"));
  xformSec.appendChild(flipRow);

  // Rotation
  const rotRow = controlRow();
  rotRow.appendChild(labelSpan("Rotation"));
  const rotSlider = document.createElement("input");
  rotSlider.type = "range"; rotSlider.min = "0"; rotSlider.max = "360"; rotSlider.step = "1";
  rotSlider.value = String(lo.rotation);
  rotSlider.style.cssText = "flex:1;cursor:pointer;accent-color:#fa0;";
  const rotVal = valueSpan(`${lo.rotation}°`);
  rotSlider.addEventListener("input", () => {
    const v = parseInt(rotSlider.value, 10);
    lo.rotation = v;
    rotVal.textContent = `${v}°`;
    markDirty();
  });
  rotRow.appendChild(rotSlider);
  rotRow.appendChild(rotVal);
  xformSec.appendChild(rotRow);

  // Scale
  const scaleRow = controlRow();
  scaleRow.appendChild(labelSpan("Scale"));
  const scaleSlider = document.createElement("input");
  scaleSlider.type = "range"; scaleSlider.min = "50"; scaleSlider.max = "200"; scaleSlider.step = "5";
  scaleSlider.value = String(Math.round(lo.scale * 100));
  scaleSlider.style.cssText = "flex:1;cursor:pointer;accent-color:#6cf;";
  const scaleVal = valueSpan(lo.scale.toFixed(2));
  scaleSlider.addEventListener("input", () => {
    const v = parseInt(scaleSlider.value, 10) / 100;
    lo.scale = v;
    scaleVal.textContent = v.toFixed(2);
    markDirty();
  });
  scaleRow.appendChild(scaleSlider);
  scaleRow.appendChild(scaleVal);
  xformSec.appendChild(scaleRow);

  root.appendChild(xformSec);

  // ---- Reset button ----
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset Layer Overrides";
  resetBtn.style.cssText =
    "width:100%;padding:4px 0;font-size:11px;background:#333;color:#ccc;" +
    "border:1px solid #555;border-radius:3px;cursor:pointer;margin-top:4px;";
  resetBtn.addEventListener("click", () => {
    lo.filterOverride = null;
    lo.shadowBlur = null;
    lo.shadowColor = null;
    lo.shadowOffsetX = null;
    lo.shadowOffsetY = null;
    lo.imageSmoothingOverride = null;
    lo.flipH = false;
    lo.rotation = 0;
    lo.scale = 1;

    filterInput.value = "";
    blurSlider.value = "0"; blurVal.textContent = "0";
    shadowPicker.value = "#000000";
    oxSlider.value = "0"; oxVal.textContent = "0";
    oySlider.value = "0"; oyVal.textContent = "0";
    smoothCb.checked = false;
    flipCb.checked = false;
    rotSlider.value = "0"; rotVal.textContent = "0°";
    scaleSlider.value = "100"; scaleVal.textContent = "1.00";

    markDirty();
  });
  root.appendChild(resetBtn);

  return root;
}

/**
 * Show the performance warning inside the deep-dive panel.
 * Called from the parent module after a benchmark run.
 */
export function showPerfWarning(panel: HTMLElement): void {
  const warn = (panel as any)._perfWarn as HTMLElement | undefined;
  if (warn) warn.style.display = "block";
}
