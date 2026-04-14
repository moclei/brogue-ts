/*
 *  platform/ui-messages.ts — DOM-based message area renderer
 *  Port V2 — rogue-ts / ui-extraction Phase 2
 *
 *  Provides:
 *    initMessagesDOM(el)            — create inner DOM structure in the messages container
 *    renderMessages(msgs, unconf)   — update message lines from state
 *    showMoreSign()                 — display the --MORE-- indicator
 *    hideMoreSign()                 — remove the --MORE-- indicator
 *    showMessageArchiveDOM(lines)   — open scrollable archive panel (async, awaits dismiss)
 *    setDOMMessagesEnabled(v)       — enable/disable DOM message rendering
 *    isDOMMessagesEnabled()         — query enabled state
 *    setMessagesCanvasSuppression(v) — suppress canvas rows 0–2 during gameplay
 *    isMessagesCanvasSuppressed()   — query suppression state
 *
 *  The messages container is #brogue-messages in index.html.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { COLOR_ESCAPE, COLOR_VALUE_INTERCEPT, MESSAGE_LINES } from "../types/constants.js";

// =============================================================================
// Data types
// =============================================================================

/** A run of visible characters sharing one CSS foreground color. */
export interface MessageSegment {
    text: string;
    /** CSS color string, e.g. "rgb(255,200,100)". */
    color: string;
}

/** One rendered message line — an ordered sequence of styled segments. */
export type MessageLineData = MessageSegment[];

// =============================================================================
// Internal module state
// =============================================================================

let messagesContainer: HTMLElement | null = null;

/**
 * Three line elements in DOM order: lineEls[0] = top (oldest = index 2),
 * lineEls[1] = middle (index 1), lineEls[2] = bottom (newest = index 0).
 * `displayedMessage[i]` maps to `lineEls[MESSAGE_LINES - 1 - i]`.
 */
const lineEls: (HTMLElement | null)[] = [null, null, null];

let moreSignEl: HTMLElement | null = null;

/**
 * Archive overlay panel — shown when the user opens the message history.
 * Nested inside the messages container, positioned absolutely.
 */
let archivePanel: HTMLElement | null = null;
let archiveContent: HTMLElement | null = null;

/** True when DOM message rendering is active. */
let domMessagesEnabled = false;

/** True when canvas rows 0–2 (message rows) should be suppressed during gameplay. */
let canvasMessagesSuppressed = false;

// =============================================================================
// Public flag accessors
// =============================================================================

/** Enable or disable DOM message rendering. Call after `initMessagesDOM`. */
export function setDOMMessagesEnabled(enabled: boolean): void {
    domMessagesEnabled = enabled;
}

/** Returns true if DOM message rendering is currently enabled. */
export function isDOMMessagesEnabled(): boolean {
    return domMessagesEnabled;
}

/**
 * Enable or disable canvas suppression of message rows (0–2).
 * Call `setMessagesCanvasSuppression(true)` when gameplay starts.
 */
export function setMessagesCanvasSuppression(active: boolean): void {
    canvasMessagesSuppressed = active;
}

/** Returns true when canvas message rows should be suppressed. */
export function isMessagesCanvasSuppressed(): boolean {
    return canvasMessagesSuppressed;
}

// =============================================================================
// setMessagesVisible / setBottomBarVisible — show/hide during gameplay
// =============================================================================

/**
 * Show or hide the DOM message area.
 * Call `setMessagesVisible(true)` when mainGameLoop starts and false when it ends.
 */
export function setMessagesVisible(visible: boolean): void {
    if (!messagesContainer) return;
    messagesContainer.style.display = visible ? "block" : "none";
}

// =============================================================================
// initMessagesDOM — create inner DOM structure
// =============================================================================

/**
 * Initialise the messages DOM inside `container` (#brogue-messages).
 * Creates three message line elements and the --MORE-- indicator.
 * Safe to call multiple times. Container starts hidden; call setMessagesVisible(true)
 * when gameplay begins.
 */
export function initMessagesDOM(container: HTMLElement): void {
    messagesContainer = container;
    container.style.display = "none"; // hidden until gameplay starts
    container.style.position = "relative";
    container.innerHTML = "";

    // Three message lines; index 0 in this array = top (oldest) line.
    // displayedMessage[2] → lineEls[0], [1] → lineEls[1], [0] → lineEls[2].
    for (let slot = 0; slot < MESSAGE_LINES; slot++) {
        const el = document.createElement("div");
        el.className = `msg-line msg-slot-${slot}`;
        el.style.cssText = [
            "min-height:1.4em",
            "line-height:1.4",
            "white-space:pre-wrap",
            "overflow:hidden",
            "position:relative",
        ].join(";");
        container.appendChild(el);
        lineEls[slot] = el;
    }

    // --MORE-- indicator, positioned at the right edge of the bottom line
    moreSignEl = document.createElement("span");
    moreSignEl.className = "msg-more";
    moreSignEl.textContent = "--MORE--";
    moreSignEl.style.cssText = [
        "display:none",
        "position:absolute",
        "right:4px",
        "bottom:0",
        "color:#fff",
        "background:#000",
        "font-weight:bold",
        "padding:0 2px",
        "z-index:2",
    ].join(";");
    container.appendChild(moreSignEl);

    // Archive panel (hidden by default, slides in from the top)
    archivePanel = document.createElement("div");
    archivePanel.className = "msg-archive-panel";
    archivePanel.style.cssText = [
        "display:none",
        "position:absolute",
        "top:0",
        "left:0",
        "right:0",
        "max-height:0",
        "overflow:hidden",
        "background:#000",
        "border:1px solid #333",
        "z-index:10",
        "transition:max-height 0.15s ease-out",
    ].join(";");

    archiveContent = document.createElement("div");
    archiveContent.className = "msg-archive-content";
    archiveContent.style.cssText = [
        "overflow-y:auto",
        "max-height:60vh",
        "padding:4px",
        "font-size:0.9em",
    ].join(";");
    archivePanel.appendChild(archiveContent);
    container.appendChild(archivePanel);
}

// =============================================================================
// Color escape parsing
// =============================================================================

/**
 * Parse a Brogue message string (which may contain COLOR_ESCAPE sequences)
 * into an array of styled text segments. Applies `dimFactor` (0–1) to all
 * color values, matching the canvas renderer's confirmed-message dimming.
 */
export function parseColorEscapes(msg: string, dimFactor: number): MessageSegment[] {
    const segments: MessageSegment[] = [];
    let currentColor = _dimCssColor(100, 100, 100, dimFactor); // white dimmed
    let textStart = 0;
    let i = 0;

    function flush(end: number): void {
        if (end > textStart) {
            const fragment = msg.slice(textStart, end);
            if (segments.length > 0 && segments[segments.length - 1].color === currentColor) {
                segments[segments.length - 1].text += fragment;
            } else {
                segments.push({ text: fragment, color: currentColor });
            }
        }
    }

    while (i < msg.length) {
        if (msg.charCodeAt(i) === COLOR_ESCAPE) {
            flush(i);
            i++; // skip escape byte

            if (i + 3 <= msg.length) {
                const r = msg.charCodeAt(i++) - COLOR_VALUE_INTERCEPT;
                const g = msg.charCodeAt(i++) - COLOR_VALUE_INTERCEPT;
                const b = msg.charCodeAt(i++) - COLOR_VALUE_INTERCEPT;
                currentColor = _dimCssColor(
                    Math.max(0, Math.min(100, r)),
                    Math.max(0, Math.min(100, g)),
                    Math.max(0, Math.min(100, b)),
                    dimFactor,
                );
            }
            textStart = i;
        } else {
            i++;
        }
    }

    flush(i);
    return segments;
}

/** Convert Brogue 0–100 RGB + dim factor to a CSS rgb() string. */
function _dimCssColor(r: number, g: number, b: number, dim: number): string {
    return `rgb(${Math.round(r * 2.55 * dim)},${Math.round(g * 2.55 * dim)},${Math.round(b * 2.55 * dim)})`;
}

/**
 * Compute the dim factor for message line index `i` given `messagesUnconfirmed`.
 *
 * Mirrors the canvas logic:
 *   - i < messagesUnconfirmed → fully bright (1.0)
 *   - otherwise → applyColorAverage(50%) then applyColorAverage(75*i/MESSAGE_LINES%)
 *
 * Result range: 1.0 (fully bright) down to ~0.25 (oldest confirmed).
 */
export function messageDimFactor(i: number, messagesUnconfirmed: number): number {
    if (i < messagesUnconfirmed) return 1.0;
    const base = 0.5;
    const extra = 1.0 - (0.75 * i / MESSAGE_LINES);
    return base * extra;
}

// =============================================================================
// renderMessages — update DOM from message state
// =============================================================================

/**
 * Update the message line elements to reflect `displayedMessage` and
 * `messagesUnconfirmed`. Called by the message wiring whenever
 * `updateMessageDisplay` runs (in DOM mode).
 *
 * `displayedMessage[0]` is the newest message (bottom row).
 * `displayedMessage[MESSAGE_LINES-1]` is the oldest (top row).
 */
export function renderMessages(displayedMessage: string[], messagesUnconfirmed: number): void {
    if (!messagesContainer) return;

    for (let i = 0; i < MESSAGE_LINES; i++) {
        // lineEls[0] = top = oldest = displayedMessage[MESSAGE_LINES-1-0] = [2]
        // lineEls[2] = bottom = newest = displayedMessage[0]
        const msgIndex = MESSAGE_LINES - 1 - i;
        const el = lineEls[i];
        if (!el) continue;

        const msg = displayedMessage[msgIndex] ?? "";
        const dim = messageDimFactor(msgIndex, messagesUnconfirmed);

        el.innerHTML = "";

        if (!msg) continue;

        const segments = parseColorEscapes(msg, dim);
        for (const seg of segments) {
            if (!seg.text) continue;
            const span = document.createElement("span");
            span.style.color = seg.color;
            span.textContent = seg.text;
            el.appendChild(span);
        }
    }
}

// =============================================================================
// showMoreSign / hideMoreSign
// =============================================================================

/** Show the --MORE-- indicator on the newest message line. */
export function showMoreSign(): void {
    if (moreSignEl) moreSignEl.style.display = "inline";
}

/** Hide the --MORE-- indicator. */
export function hideMoreSign(): void {
    if (moreSignEl) moreSignEl.style.display = "none";
}

// =============================================================================
// showMessageArchiveDOM — async scrollable archive panel
// =============================================================================

/**
 * Open the DOM message archive panel, populate it with `lines` (oldest first),
 * and return a Promise that resolves when the user dismisses it
 * (Space, Escape, or click outside).
 */
export async function showMessageArchiveDOM(lines: string[]): Promise<void> {
    if (!archivePanel || !archiveContent || !messagesContainer) return;

    // Populate content
    archiveContent.innerHTML = "";
    for (const line of lines) {
        const lineEl = document.createElement("div");
        lineEl.className = "msg-archive-line";
        lineEl.style.cssText = [
            "line-height:1.4",
            "min-height:1.2em",
            "color:#ccc",
            "white-space:pre-wrap",
        ].join(";");

        if (!line) {
            lineEl.innerHTML = "&nbsp;";
        } else {
            const segs = parseColorEscapes(line, 1.0);
            for (const seg of segs) {
                if (!seg.text) continue;
                const sp = document.createElement("span");
                sp.style.color = seg.color;
                sp.textContent = seg.text;
                lineEl.appendChild(sp);
            }
        }
        archiveContent.appendChild(lineEl);
    }

    // Scroll archive to bottom (most recent messages) by default
    archiveContent.scrollTop = archiveContent.scrollHeight;

    // Show the panel with slide-in transition
    archivePanel.style.display = "block";
    // Trigger reflow so the transition fires
    void archivePanel.offsetHeight;
    archivePanel.style.maxHeight = "60vh";

    return new Promise<void>((resolve) => {
        let settled = false;

        function dismiss(): void {
            if (settled) return;
            settled = true;
            // Slide out
            archivePanel!.style.maxHeight = "0";
            archivePanel!.addEventListener("transitionend", () => {
                if (archivePanel) archivePanel.style.display = "none";
            }, { once: true });
            cleanup();
            resolve();
        }

        function onKey(e: KeyboardEvent): void {
            if (e.key === " " || e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                dismiss();
            } else if (e.key === "ArrowUp" || e.key === "k") {
                archiveContent!.scrollTop -= 40;
            } else if (e.key === "ArrowDown" || e.key === "j") {
                archiveContent!.scrollTop += 40;
            } else if (e.key === "PageUp") {
                archiveContent!.scrollTop -= archiveContent!.clientHeight;
            } else if (e.key === "PageDown") {
                archiveContent!.scrollTop += archiveContent!.clientHeight;
            }
        }

        function onDocClick(e: MouseEvent): void {
            if (archivePanel && !archivePanel.contains(e.target as Node)) {
                dismiss();
            }
        }

        document.addEventListener("keydown", onKey, { capture: true });
        document.addEventListener("click", onDocClick);

        function cleanup(): void {
            document.removeEventListener("keydown", onKey, { capture: true });
            document.removeEventListener("click", onDocClick);
        }
    });
}
