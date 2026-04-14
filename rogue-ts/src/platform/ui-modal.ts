/*
 *  platform/ui-modal.ts — Generic DOM modal infrastructure
 *  Port V2 — rogue-ts / ui-extraction Phase 3a
 *
 *  Provides:
 *    showModal(content)      — display a viewport-centered modal and await dismiss
 *    hideModal()             — programmatically dismiss any open modal
 *    setDOMModalEnabled(v)   — enable/disable DOM modal rendering
 *    isDOMModalEnabled()     — query enabled state
 *
 *  All modals use position:fixed centering and are independent of dungeon
 *  cell coordinates or canvas dimensions. A semi-transparent backdrop sits
 *  over the entire viewport while the modal is open. Any keydown or
 *  mousedown on the backdrop (outside the modal panel) dismisses the modal;
 *  for simple dismissables, mousedown inside the panel also dismisses.
 *
 *  Event capture: while a modal is open, keyboard and mouse events are
 *  consumed by the modal layer and do not reach the canvas / game loop.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// =============================================================================
// Module state
// =============================================================================

let _domModalEnabled = false;

/** Active backdrop element while a modal is open. */
let _backdrop: HTMLElement | null = null;

/** Resolve function for the current open modal's promise. */
let _resolveModal: (() => void) | null = null;

// =============================================================================
// Flag accessors
// =============================================================================

/** Enable or disable DOM modal rendering. */
export function setDOMModalEnabled(enabled: boolean): void {
    _domModalEnabled = enabled;
}

/** Returns true when DOM modal rendering is active. */
export function isDOMModalEnabled(): boolean {
    return _domModalEnabled;
}

// =============================================================================
// Internal dismiss logic
// =============================================================================

function _dismiss(): void {
    if (!_backdrop) return;
    document.removeEventListener("keydown", _onKeyDown, { capture: true });
    _backdrop.remove();
    _backdrop = null;
    const resolve = _resolveModal;
    _resolveModal = null;
    resolve?.();
}

function _onKeyDown(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    _dismiss();
}

// =============================================================================
// showModal — display content in a centered modal and await dismiss
// =============================================================================

/**
 * Options for `showModal`.
 */
export interface ModalOptions {
    /**
     * When true (default), any mousedown anywhere dismisses the modal.
     * When false, only keydown dismisses; mousedown on backdrop only.
     */
    dismissOnAnyClick?: boolean;
}

/**
 * Display `content` inside a backdrop-dimmed, viewport-centered modal panel.
 * Returns a Promise that resolves when the modal is dismissed.
 *
 * Dismiss triggers (simple dismissables):
 *   - Any keydown event
 *   - Any mousedown event (default: dismissOnAnyClick = true)
 *
 * While open, keyboard events are captured at the document level so they
 * do not reach the game's canvas event listeners.
 */
export function showModal(content: HTMLElement, options: ModalOptions = {}): Promise<void> {
    const { dismissOnAnyClick = true } = options;

    return new Promise<void>(resolve => {
        // If a modal is already open, dismiss it before opening a new one.
        if (_backdrop) _dismiss();

        _resolveModal = resolve;

        // --- Backdrop ---
        _backdrop = document.createElement("div");
        _backdrop.className = "brogue-modal-backdrop";
        _backdrop.style.cssText = [
            "position:fixed",
            "inset:0",
            "background:rgba(0,0,0,0.80)",
            "z-index:1000",
            "display:flex",
            "align-items:center",
            "justify-content:center",
        ].join(";");

        // --- Modal panel ---
        const panel = document.createElement("div");
        panel.className = "brogue-modal-panel";
        panel.style.cssText = [
            "background:#0a0a0a",
            "border:1px solid #444",
            "padding:1.5em 2em",
            "max-width:min(90vw, 800px)",
            "max-height:85vh",
            "overflow-y:auto",
            "font-family:monospace",
            "font-size:14px",
            "line-height:1.5",
            "color:#ccc",
            "box-sizing:border-box",
        ].join(";");

        panel.appendChild(content);
        _backdrop.appendChild(panel);
        document.body.appendChild(_backdrop);

        // --- Event capture ---
        document.addEventListener("keydown", _onKeyDown, { capture: true });

        if (dismissOnAnyClick) {
            // Any mousedown dismisses (backdrop or panel).
            // This matches the C behavior: any mouse click dismisses.
            // Mouse wheel (scroll) does not fire mousedown so scrolling still works.
            _backdrop.addEventListener("mousedown", () => _dismiss(), { capture: true });
        } else {
            // Only backdrop mousedown dismisses (panel clicks do not).
            _backdrop.addEventListener("mousedown", (e) => {
                if (e.target === _backdrop) _dismiss();
            });
        }
    });
}

/**
 * Programmatically dismiss any currently open modal.
 * No-op if no modal is open.
 */
export function hideModal(): void {
    _dismiss();
}
