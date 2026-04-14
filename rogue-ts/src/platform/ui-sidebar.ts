/*
 *  platform/ui-sidebar.ts — DOM-based sidebar renderer
 *  Port V2 — rogue-ts / ui-extraction Phase 1
 *
 *  Provides:
 *    SidebarRenderData    — serializable data type for sidebar state
 *    initSidebarDOM(el)   — create inner DOM structure in the sidebar container
 *    renderSidebar(data)  — update DOM elements from SidebarRenderData
 *    setSidebarVisible(v) — show/hide the DOM sidebar (e.g. during iris fades)
 *
 *  The sidebar container is #brogue-sidebar in index.html.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// =============================================================================
// Color helpers
// =============================================================================

/** RGB color in 0–255 range, suitable for CSS. */
export interface CssRgb {
    r: number;
    g: number;
    b: number;
}

/** Convert a `CssRgb` to a CSS `rgb()` string. */
export function cssRgbStr(c: CssRgb): string {
    return `rgb(${c.r},${c.g},${c.b})`;
}

/** Convert a Brogue 0–100 component value to 0–255. */
export function brogueComponent(v: number): number {
    return Math.round(v * 255 / 100);
}

/** Build a `CssRgb` from three Brogue 0–100 component values. */
export function cssRgbFromBrogue(r: number, g: number, b: number): CssRgb {
    return {
        r: brogueComponent(r),
        g: brogueComponent(g),
        b: brogueComponent(b),
    };
}

// =============================================================================
// Data types — serializable, no functions or closures
// =============================================================================

/** One progress bar row in the sidebar. */
export interface ProgressBarData {
    label: string;
    /** Filled fraction, clamped to 0–1. */
    fraction: number;
    fillColor: CssRgb;
    emptyColor: CssRgb;
}

/** A single text line in the sidebar (behavior state, mutation, stats, etc.). */
export interface TextLineData {
    text: string;
    color: CssRgb;
}

/** One entity entry in the sidebar (creature, floor item, or terrain feature). */
export interface SidebarEntityData {
    type: "creature" | "item" | "terrain";

    /** Dungeon map coordinates — used for hover/highlight wiring. */
    mapX: number;
    mapY: number;

    /**
     * First row in the full 100×34 grid that this entity occupies.
     * Maps directly to `rogue.sidebarLocationList` indices.
     */
    sidebarRowStart: number;

    /** Total rows this entity occupies in the sidebar (for sidebarLocationList). */
    sidebarRowCount: number;

    /** Entity glyph as a Unicode string. */
    glyphChar: string;
    glyphForeColor: CssRgb;
    glyphBackColor: CssRgb;

    /** Carried item glyph (for monsters carrying items). */
    carriedItemChar?: string;
    carriedItemColor?: CssRgb;

    /** Primary name line (plain text, color escapes stripped). */
    nameText: string;
    nameColor: CssRgb;

    /** Whether the entity is dimmed (not the focus). */
    dim: boolean;

    /** Whether this entity has keyboard/hover focus. */
    focused: boolean;

    /** Progress bars (health, nutrition, status effects, absorb, playback turn). */
    bars: ProgressBarData[];

    /** Extra text lines below the name (behavior state, mutation, stats, stealth). */
    lines: TextLineData[];
}

/** Playback-mode header shown at the top of the sidebar. */
export interface PlaybackHeaderData {
    turnLabel: string;
    /** 0–1 fraction for the turn progress bar. */
    turnFraction: number;
    paused: boolean;
    outOfSync: boolean;
}

/** Full data snapshot passed to `renderSidebar`. Serializable — no functions. */
export interface SidebarRenderData {
    playbackHeader?: PlaybackHeaderData;
    entities: SidebarEntityData[];
    depthLevel: number;
    showDepthFooter: boolean;
}

// =============================================================================
// Internal module state
// =============================================================================

let sidebarContainer: HTMLElement | null = null;
let playbackHeaderEl: HTMLElement | null = null;
let entityListEl: HTMLElement | null = null;
let depthFooterEl: HTMLElement | null = null;

/** True when DOM sidebar rendering is active. Set by `setDOMSidebarEnabled`. */
let domSidebarEnabled = false;

/**
 * True when canvas sidebar columns (0–STAT_BAR_WIDTH) should be suppressed.
 * Only active during gameplay (mainGameLoop) — not during title/menu screens.
 */
let canvasSidebarSuppressed = false;

/**
 * Callback invoked when the pointer enters a sidebar entity card.
 * Receives the entity's dungeon map coordinates (mapX, mapY).
 * Typically routes through the main game hover handler to trigger
 * path highlighting and sidebar focus update.
 */
let _onSidebarHover: ((mapX: number, mapY: number) => void) | null = null;

/**
 * Callback invoked when the pointer leaves the sidebar entity list.
 * Used to clear the hover highlight on the canvas and sidebar.
 */
let _onSidebarClear: (() => void) | null = null;

/** Enable or disable DOM sidebar rendering. Call after `initSidebarDOM`. */
export function setDOMSidebarEnabled(enabled: boolean): void {
    domSidebarEnabled = enabled;
}

/** Returns true if DOM sidebar rendering is currently enabled. */
export function isDOMSidebarEnabled(): boolean {
    return domSidebarEnabled;
}

/**
 * Enable or disable suppression of canvas sidebar columns.
 * Call `setSidebarCanvasSuppression(true)` when gameplay starts and
 * `setSidebarCanvasSuppression(false)` when it ends (return to menu).
 * Suppression is separate from DOM enablement so the title screen retains
 * full canvas access even when DOM sidebar is initialized.
 */
export function setSidebarCanvasSuppression(active: boolean): void {
    canvasSidebarSuppressed = active;
}

/** Returns true when canvas sidebar columns should be suppressed. */
export function isSidebarCanvasSuppressed(): boolean {
    return canvasSidebarSuppressed;
}

/**
 * Register hover callbacks for DOM sidebar → canvas interaction.
 *
 * `onHover(mapX, mapY)` is called when the pointer enters a sidebar entity
 * card; it should trigger the canvas hover handler (path highlight + sidebar
 * focus update). Typically the return value of `buildHoverHandlerFn()`.
 *
 * `onClear()` is called when the pointer leaves the entity list; it should
 * clear the hover path highlight. Pass `null` to deregister both.
 */
export function setSidebarHoverCallbacks(
    onHover: ((mapX: number, mapY: number) => void) | null,
    onClear: (() => void) | null,
): void {
    _onSidebarHover = onHover;
    _onSidebarClear = onClear;
}

// =============================================================================
// initSidebarDOM — create inner DOM structure
// =============================================================================

/**
 * Initialise the sidebar DOM inside `container` (expected to be #brogue-sidebar).
 * Creates the playback header, entity list, and depth footer elements.
 * Safe to call multiple times — re-initialises state.
 */
export function initSidebarDOM(container: HTMLElement): void {
    sidebarContainer = container;

    // Show the container (it's display:none by default in CSS)
    container.style.display = "flex";
    container.style.flexDirection = "column";

    // Clear any existing children
    container.innerHTML = "";

    // Playback header (hidden until playback mode is active)
    playbackHeaderEl = document.createElement("div");
    playbackHeaderEl.className = "sb-playback-header";
    playbackHeaderEl.style.cssText = [
        "display:none",
        "padding:2px 0",
        "border-bottom:1px solid #333",
        "margin-bottom:4px",
    ].join(";");
    container.appendChild(playbackHeaderEl);

    // Entity list
    entityListEl = document.createElement("div");
    entityListEl.className = "sb-entity-list";
    entityListEl.style.cssText = "flex:1;overflow:hidden";

    // When the pointer leaves the whole entity list, clear hover highlight
    entityListEl.addEventListener("mouseleave", () => {
        if (_onSidebarClear) _onSidebarClear();
    });

    container.appendChild(entityListEl);

    // Depth footer
    depthFooterEl = document.createElement("div");
    depthFooterEl.className = "sb-depth-footer";
    depthFooterEl.style.cssText = [
        "text-align:center",
        "padding:2px 0",
        "border-top:1px solid #333",
        "color:#aaa",
        "font-size:0.85em",
        "margin-top:auto",
    ].join(";");
    container.appendChild(depthFooterEl);
}

// =============================================================================
// renderSidebar — update DOM from SidebarRenderData
// =============================================================================

/**
 * Update the sidebar DOM elements to reflect `data`.
 * Clears and rebuilds entity entries on each call.
 * Called by the sidebar wiring layer whenever `refreshSideBar` runs.
 */
export function renderSidebar(data: SidebarRenderData): void {
    if (!sidebarContainer || !entityListEl || !playbackHeaderEl || !depthFooterEl) {
        return;
    }

    _renderPlaybackHeader(data.playbackHeader);
    _renderEntityList(data.entities);
    _renderDepthFooter(data.depthLevel, data.showDepthFooter);
}

// =============================================================================
// setSidebarVisible — show/hide the DOM sidebar
// =============================================================================

/**
 * Show or hide the DOM sidebar. Used to suppress the sidebar during
 * full-grid visual effects (iris fades, death fade, blackOutScreen).
 */
export function setSidebarVisible(visible: boolean): void {
    if (!sidebarContainer) return;
    sidebarContainer.style.display = visible ? "flex" : "none";
}

// =============================================================================
// Internal render helpers
// =============================================================================

function _renderPlaybackHeader(header: PlaybackHeaderData | undefined): void {
    if (!playbackHeaderEl) return;

    if (!header) {
        playbackHeaderEl.style.display = "none";
        return;
    }

    playbackHeaderEl.style.display = "block";
    playbackHeaderEl.innerHTML = "";

    const label = document.createElement("div");
    label.textContent = "-- PLAYBACK --";
    label.style.cssText = "text-align:center;color:#fff;font-weight:bold";
    playbackHeaderEl.appendChild(label);

    if (header.turnFraction > 0) {
        const bar = _makeProgressBar({
            label: header.turnLabel,
            fraction: header.turnFraction,
            fillColor: { r: 100, g: 50, b: 140 },
            emptyColor: { r: 30, g: 15, b: 45 },
        }, false);
        playbackHeaderEl.appendChild(bar);
    }

    if (header.outOfSync) {
        const oos = document.createElement("div");
        oos.textContent = "[OUT OF SYNC]";
        oos.style.cssText = "text-align:center;color:#f55";
        playbackHeaderEl.appendChild(oos);
    } else if (header.paused) {
        const p = document.createElement("div");
        p.textContent = "[PAUSED]";
        p.style.cssText = "text-align:center;color:#aaa";
        playbackHeaderEl.appendChild(p);
    }
}

function _renderEntityList(entities: SidebarEntityData[]): void {
    if (!entityListEl) return;

    entityListEl.innerHTML = "";

    for (const entity of entities) {
        const card = _makeEntityCard(entity);
        entityListEl.appendChild(card);
    }
}

function _renderDepthFooter(depthLevel: number, show: boolean): void {
    if (!depthFooterEl) return;

    if (!show) {
        depthFooterEl.style.display = "none";
        return;
    }

    depthFooterEl.style.display = "block";
    depthFooterEl.textContent = `-- Depth: ${depthLevel} --`;
}

// =============================================================================
// Entity card construction
// =============================================================================

function _makeEntityCard(entity: SidebarEntityData): HTMLElement {
    const card = document.createElement("div");
    card.className = "sb-entity";
    card.dataset.mapX = String(entity.mapX);
    card.dataset.mapY = String(entity.mapY);
    card.dataset.rowStart = String(entity.sidebarRowStart);
    card.dataset.rowCount = String(entity.sidebarRowCount);
    card.style.cssText = [
        "padding:1px 0",
        "border-bottom:1px solid #1a1a1a",
        "cursor:default",
        entity.focused ? "background:#1c1c1c" : "",
    ].filter(Boolean).join(";");

    // DOM hover → dungeon cell highlighting: route through the canvas hover handler
    card.addEventListener("mouseenter", () => {
        if (_onSidebarHover) {
            _onSidebarHover(entity.mapX, entity.mapY);
        }
    });

    // Name / glyph header row
    const header = document.createElement("div");
    header.className = "sb-entity-header";
    header.style.cssText = "display:flex;align-items:baseline;gap:2px;padding:0 2px";

    const glyphSpan = document.createElement("span");
    glyphSpan.className = "sb-glyph";
    glyphSpan.textContent = entity.glyphChar;
    glyphSpan.style.cssText = [
        `color:${cssRgbStr(entity.glyphForeColor)}`,
        `background:${cssRgbStr(entity.glyphBackColor)}`,
        "display:inline-block",
        "width:1.1em",
        "text-align:center",
        "flex-shrink:0",
    ].join(";");
    header.appendChild(glyphSpan);

    if (entity.carriedItemChar && entity.carriedItemColor) {
        const itemSpan = document.createElement("span");
        itemSpan.className = "sb-carried-item";
        itemSpan.textContent = entity.carriedItemChar;
        itemSpan.style.cssText = `color:${cssRgbStr(entity.carriedItemColor)};flex-shrink:0`;
        header.appendChild(itemSpan);
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "sb-entity-name";
    nameSpan.textContent = entity.nameText;
    nameSpan.style.cssText = [
        `color:${cssRgbStr(entity.nameColor)}`,
        "overflow:hidden",
        "text-overflow:ellipsis",
        "white-space:nowrap",
        "flex:1",
        "font-size:0.9em",
    ].join(";");
    header.appendChild(nameSpan);

    card.appendChild(header);

    // Progress bars
    for (const bar of entity.bars) {
        card.appendChild(_makeProgressBar(bar, entity.dim));
    }

    // Extra text lines
    for (const line of entity.lines) {
        const lineEl = document.createElement("div");
        lineEl.className = "sb-text-line";
        lineEl.textContent = line.text;
        lineEl.style.cssText = [
            `color:${cssRgbStr(line.color)}`,
            "text-align:center",
            "font-size:0.8em",
            "padding:0 2px",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "white-space:nowrap",
        ].join(";");
        card.appendChild(lineEl);
    }

    return card;
}

// =============================================================================
// Progress bar implementation — styled <div> elements
// =============================================================================

/**
 * Create a progress bar DOM element matching the Brogue 20-column bar style.
 * The bar is a flex row: filled region left, empty region right, label centered.
 */
function _makeProgressBar(bar: ProgressBarData, dim: boolean): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "sb-bar";
    wrapper.style.cssText = [
        "position:relative",
        "height:1.1em",
        "overflow:hidden",
        "margin:1px 2px",
        "display:flex",
        "align-items:center",
    ].join(";");

    const fraction = Math.max(0, Math.min(1, bar.fraction));
    const fillPct = `${(fraction * 100).toFixed(1)}%`;
    const emptyPct = `${((1 - fraction) * 100).toFixed(1)}%`;

    const fillRgb = dim ? _dimColor(bar.fillColor) : bar.fillColor;
    const emptyRgb = dim ? _dimColor(bar.emptyColor) : bar.emptyColor;

    // Fill segment
    const fill = document.createElement("div");
    fill.className = "sb-bar-fill";
    fill.style.cssText = [
        `width:${fillPct}`,
        `background:${cssRgbStr(fillRgb)}`,
        "height:100%",
        "flex-shrink:0",
        "position:absolute",
        "left:0",
        "top:0",
    ].join(";");
    wrapper.appendChild(fill);

    // Empty segment
    const empty = document.createElement("div");
    empty.className = "sb-bar-empty";
    empty.style.cssText = [
        `width:${emptyPct}`,
        `background:${cssRgbStr(emptyRgb)}`,
        "height:100%",
        "flex-shrink:0",
        "position:absolute",
        "right:0",
        "top:0",
    ].join(";");
    wrapper.appendChild(empty);

    // Label (centered, above fill/empty)
    const label = document.createElement("span");
    label.className = "sb-bar-label";
    label.textContent = bar.label;
    label.style.cssText = [
        "position:relative",
        "z-index:1",
        "width:100%",
        "text-align:center",
        "font-size:0.78em",
        "color:#fff",
        "pointer-events:none",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "white-space:nowrap",
        "padding:0 2px",
    ].join(";");
    wrapper.appendChild(label);

    return wrapper;
}

/** Dim a color by 50% toward black (matches Brogue's dim logic). */
function _dimColor(c: CssRgb): CssRgb {
    return {
        r: Math.round(c.r * 0.5),
        g: Math.round(c.g * 0.5),
        b: Math.round(c.b * 0.5),
    };
}
