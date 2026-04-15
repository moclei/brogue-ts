/*
 *  platform/ui-bottom-bar.ts — DOM-based bottom bar renderer
 *  Port V2 — rogue-ts / ui-extraction Phase 2
 *
 *  Provides:
 *    initBottomBarDOM(el)            — create DOM structure in the bottom bar container
 *    renderBottomBarButtons(buttons) — update button elements from BottomBarButtonData[]
 *    updateFlavorTextDOM(text)       — update the flavor text line
 *    setBottomBarClickCallback(fn)   — register handler for button clicks (index)
 *    setDOMBottomBarEnabled(v)       — enable/disable DOM bottom bar rendering
 *    isDOMBottomBarEnabled()         — query enabled state
 *    setBottomBarCanvasSuppression(v) — suppress canvas rows 32–33 during gameplay
 *    isBottomBarCanvasSuppressed()   — query suppression state
 *
 *  The bottom bar container is #brogue-bottom-bar in index.html.
 *  Click events dispatch via a registered callback — platform.ts registers
 *  the callback in mainGameLoop and injects the corresponding keystroke.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { COLOR_ESCAPE } from "../types/constants.js";

// =============================================================================
// Data types
// =============================================================================

/**
 * Serializable description of one bottom-bar button.
 * Built from ButtonState by the wiring layer in platform.ts.
 */
export interface BottomBarButtonData {
    /** Button index within the ButtonState array (0–4). */
    index: number;
    /** Full label text with color escape sequences included. */
    rawText: string;
    /** Primary hotkey character code (0 = none). */
    hotkey: number;
    /** Window-coordinate X of the button (for click dispatch). */
    windowX: number;
    /** Window-coordinate Y of the button (for click dispatch). */
    windowY: number;
    enabled: boolean;
}

// =============================================================================
// Internal module state
// =============================================================================

let buttonRowEl: HTMLElement | null = null;
let flavorTextEl: HTMLElement | null = null;

/** Registered callback invoked when a DOM button is clicked. Receives button index. */
let _onButtonClick: ((buttonIndex: number) => void) | null = null;

/** True when DOM bottom bar rendering is active. */
let domBottomBarEnabled = false;

/** True when canvas rows 32–33 (bottom rows) should be suppressed during gameplay. */
let canvasBottomBarSuppressed = false;

// =============================================================================
// Public flag accessors
// =============================================================================

/** Enable or disable DOM bottom bar rendering. Call after `initBottomBarDOM`. */
export function setDOMBottomBarEnabled(enabled: boolean): void {
    domBottomBarEnabled = enabled;
}

/** Returns true if DOM bottom bar rendering is currently enabled. */
export function isDOMBottomBarEnabled(): boolean {
    return domBottomBarEnabled;
}

/**
 * Enable or disable canvas suppression of bottom rows (32–33).
 * Call `setBottomBarCanvasSuppression(true)` when gameplay starts.
 */
export function setBottomBarCanvasSuppression(active: boolean): void {
    canvasBottomBarSuppressed = active;
}

/** Returns true when canvas bottom rows should be suppressed. */
export function isBottomBarCanvasSuppressed(): boolean {
    return canvasBottomBarSuppressed;
}

/**
 * Register a callback invoked when a bottom bar button is clicked.
 * The callback receives the button index (0–4).
 * Set to null to deregister. Call from `mainGameLoop` in platform.ts.
 */
export function setBottomBarClickCallback(fn: ((buttonIndex: number) => void) | null): void {
    _onButtonClick = fn;
}

// =============================================================================
// setBottomBarVisible — show/hide during gameplay
// =============================================================================

let _bottomBarEl: HTMLElement | null = null;

/**
 * Show or hide the DOM bottom bar.
 * Call `setBottomBarVisible(true)` when mainGameLoop starts and false when it ends.
 */
export function setBottomBarVisible(visible: boolean): void {
    if (!_bottomBarEl) return;
    _bottomBarEl.style.display = visible ? "flex" : "none";
}

// =============================================================================
// initBottomBarDOM — create inner DOM structure
// =============================================================================

/**
 * Initialise the bottom bar DOM inside `container` (#brogue-bottom-bar).
 * Creates a button row and a flavor text line.
 * Safe to call multiple times. Container starts hidden; call setBottomBarVisible(true)
 * when gameplay begins.
 */
export function initBottomBarDOM(container: HTMLElement): void {
    _bottomBarEl = container;
    container.style.display = "none"; // hidden until gameplay starts
    container.style.flexDirection = "column";
    container.innerHTML = "";

    // Flavor text line (above button row, matching canvas row 32)
    flavorTextEl = document.createElement("div");
    flavorTextEl.className = "bb-flavor";
    flavorTextEl.style.cssText = [
        "min-height:1.4em",
        "line-height:1.4",
        "padding:0 4px",
        "white-space:pre-wrap",
        "overflow:hidden",
        "color:#9d9d9d",
    ].join(";");
    container.appendChild(flavorTextEl);

    // Button row (canvas row 33)
    buttonRowEl = document.createElement("div");
    buttonRowEl.className = "bb-buttons";
    buttonRowEl.style.cssText = [
        "display:flex",
        "flex-direction:row",
        "gap:2px",
        "padding:1px 2px",
        "align-items:center",
    ].join(";");
    container.appendChild(buttonRowEl);

    // Event delegation: fire on mousedown so the handler runs before the idle
    // animation loop (which runs every 25ms) can recreate the button elements.
    // Per-button click listeners would break if the element is destroyed and
    // recreated between mousedown and mouseup.
    buttonRowEl.addEventListener("mousedown", (e) => {
        const target = (e.target as HTMLElement).closest(".bb-btn") as HTMLButtonElement | null;
        if (!target || target.disabled) return;
        e.preventDefault();
        const idx = parseInt(target.dataset.index ?? "-1", 10);
        if (idx >= 0) _onButtonClick?.(idx);
    });
}

// =============================================================================
// Color escape helpers
// =============================================================================

interface _Segment { text: string; isHotkey: boolean; cssColor: string }

/** Strip Brogue 4-byte color escape sequences (COLOR_ESCAPE + 3 RGB bytes). */
function _stripEscapes(raw: string): string {
    let out = "";
    let i = 0;
    while (i < raw.length) {
        if (raw.charCodeAt(i) === COLOR_ESCAPE) {
            i += 4; // skip escape byte + 3 RGB bytes
        } else {
            out += raw[i++];
        }
    }
    return out;
}

/**
 * Parse a button label into segments. Strips color escape sequences and
 * finds the hotkey character (first occurrence of the hotkey char code in
 * the cleaned text), rendering it in gold. Everything else is white.
 */
function _parseButtonLabel(raw: string, hotkeyCharCode: number): _Segment[] {
    const GOLD = "rgb(255,204,0)";
    const WHITE = "rgb(200,200,200)";
    const text = _stripEscapes(raw).trim();
    if (!hotkeyCharCode) return [{ text, isHotkey: false, cssColor: WHITE }];
    const hotkey = String.fromCharCode(hotkeyCharCode);
    const idx = text.indexOf(hotkey);
    if (idx < 0) return [{ text, isHotkey: false, cssColor: WHITE }];
    const segs: _Segment[] = [];
    if (idx > 0) segs.push({ text: text.slice(0, idx), isHotkey: false, cssColor: WHITE });
    segs.push({ text: hotkey, isHotkey: true, cssColor: GOLD });
    if (idx + 1 < text.length) segs.push({ text: text.slice(idx + 1), isHotkey: false, cssColor: WHITE });
    return segs;
}

// =============================================================================
// renderBottomBarButtons — update button DOM elements
// =============================================================================

/**
 * Rebuild the button row elements to reflect `buttons`.
 * Called by the wiring layer alongside (or instead of) `drawGameMenuButtons`.
 */
export function renderBottomBarButtons(buttons: BottomBarButtonData[]): void {
    if (!buttonRowEl) return;

    buttonRowEl.innerHTML = "";

    for (const btn of buttons) {
        const segs = _parseButtonLabel(btn.rawText, btn.hotkey);
        const btnEl = document.createElement("button");
        btnEl.type = "button";
        btnEl.className = "bb-btn";
        btnEl.dataset.index = String(btn.index);
        btnEl.disabled = !btn.enabled;
        btnEl.style.cssText = [
            "background:#1a1a2e",
            "border:1px solid #444",
            "border-radius:2px",
            "padding:2px 6px",
            "cursor:pointer",
            "font-family:monospace",
            "font-size:0.9em",
            "color:#ccc",
            "white-space:nowrap",
            btn.enabled ? "" : "opacity:0.5",
        ].filter(Boolean).join(";");

        // Hover styles via mouseenter/mouseleave (visual only — click is delegated)
        btnEl.addEventListener("mouseenter", () => {
            if (btn.enabled) btnEl.style.background = "#2a2a4e";
        });
        btnEl.addEventListener("mouseleave", () => {
            btnEl.style.background = "#1a1a2e";
        });

        // Populate label with styled spans for hotkey chars
        for (const seg of segs) {
            if (!seg.text) continue;
            const sp = document.createElement("span");
            sp.textContent = seg.text;
            if (seg.isHotkey) {
                sp.style.cssText = "color:" + seg.cssColor + ";font-weight:bold";
            } else {
                sp.style.color = seg.cssColor;
            }
            btnEl.appendChild(sp);
        }

        buttonRowEl.appendChild(btnEl);
    }
}

// =============================================================================
// updateFlavorTextDOM — update the flavor text line
// =============================================================================

/**
 * Update the flavor text line with the provided plain text (color escapes stripped).
 * Called by the wiring layer when `flavorMessage` runs.
 *
 * `rawText` may contain Brogue color escape sequences; they are parsed and
 * rendered as styled spans, matching the canvas flavorTextColor palette.
 */
export function updateFlavorTextDOM(rawText: string): void {
    if (!flavorTextEl) return;
    flavorTextEl.innerHTML = "";

    if (!rawText) return;

    const text = _stripEscapes(rawText);
    flavorTextEl.textContent = text;
}
