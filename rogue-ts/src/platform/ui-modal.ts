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

/** Active backdrop element while a simple dismissable modal is open. */
let _backdrop: HTMLElement | null = null;

/** Resolve function for the current open simple modal's promise. */
let _resolveModal: (() => void) | null = null;

/** Active backdrop element while a text-box modal (with buttons) is open. */
let _tbBackdrop: HTMLElement | null = null;

/** Cleanup function for an active text-box modal (removes listeners + backdrop). */
let _tbCleanup: (() => void) | null = null;

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

// =============================================================================
// Text-box modal (printTextBox DOM replacement)
// =============================================================================

/**
 * A simplified button descriptor for DOM text-box modals.
 * Callers strip Brogue color escape codes before creating these.
 */
export interface ModalButton {
    /** Plain-text label shown on the button element. */
    label: string;
    /** Key char codes that trigger this button (Brogue hotkey convention). */
    hotkeys: number[];
}

/** Active non-blocking text panel element (no-button case). */
let _textPanel: HTMLElement | null = null;

/** Remove any active non-blocking text panel. */
export function hideTextPanel(): void {
    if (_textPanel) {
        _textPanel.remove();
        _textPanel = null;
    }
}

/**
 * Build a styled modal panel element containing wrapped text.
 * Applies basic Brogue color escape rendering (segments of colored spans).
 */
function _buildTextContent(text: string): HTMLElement {
    // Split on Brogue color escape byte (0x06 / char code 6) sequences.
    // Format: ESC r g b where r/g/b are offset by COLOR_VALUE_INTERCEPT (40).
    const COLOR_ESCAPE = 6;
    const INTERCEPT = 40;
    const container = document.createElement("div");
    container.style.cssText = "white-space:pre-wrap;word-break:break-word;line-height:1.6";

    let span = document.createElement("span");
    span.style.color = "#cccccc";
    let i = 0;
    const chars = text;

    while (i < chars.length) {
        if (chars.charCodeAt(i) === COLOR_ESCAPE && i + 3 < chars.length) {
            if (span.textContent) container.appendChild(span);
            const r = Math.max(0, Math.min(100, chars.charCodeAt(i + 1) - INTERCEPT));
            const g = Math.max(0, Math.min(100, chars.charCodeAt(i + 2) - INTERCEPT));
            const b = Math.max(0, Math.min(100, chars.charCodeAt(i + 3) - INTERCEPT));
            span = document.createElement("span");
            span.style.color = `rgb(${Math.round(r * 2.55)},${Math.round(g * 2.55)},${Math.round(b * 2.55)})`;
            i += 4;
        } else {
            span.textContent = (span.textContent ?? "") + chars[i];
            i++;
        }
    }
    if (span.textContent) container.appendChild(span);
    return container;
}

/**
 * Show a text box as a DOM modal.
 *
 * Without buttons (`buttons` empty or omitted):
 *   Shows a floating, non-blocking panel (no event capture). Returns -1
 *   immediately. Call `hideTextPanel()` to remove it.
 *
 * With buttons:
 *   Shows a full blocking modal with backdrop and button elements. Keyboard
 *   hotkeys and mouse clicks resolve the returned Promise with the button
 *   index (0-based). Returns the chosen button index.
 */
export function showTextBoxModal(
    text: string,
    buttons: ModalButton[] = [],
): Promise<number> {
    if (buttons.length === 0) {
        // Non-blocking floating panel.
        hideTextPanel();

        const panel = document.createElement("div");
        panel.style.cssText = [
            "position:fixed",
            "top:50%",
            "left:50%",
            "transform:translate(-50%,-50%)",
            "background:#0a0a0a",
            "border:1px solid #336655",
            "padding:1em 1.5em",
            "max-width:min(85vw,600px)",
            "max-height:80vh",
            "overflow-y:auto",
            "font-family:monospace",
            "font-size:13px",
            "line-height:1.5",
            "color:#ccc",
            "pointer-events:none",
            "z-index:900",
        ].join(";");

        panel.appendChild(_buildTextContent(text));
        document.body.appendChild(panel);
        _textPanel = panel;
        return Promise.resolve(-1);
    }

    // Blocking modal with buttons — uses separate state from showModal().
    return new Promise<number>(resolve => {
        // Dismiss any existing text-box or simple modal first.
        _dismissTextBox();
        if (_backdrop) _dismiss();

        // Backdrop
        _tbBackdrop = document.createElement("div");
        _tbBackdrop.className = "brogue-modal-backdrop";
        _tbBackdrop.style.cssText = [
            "position:fixed",
            "inset:0",
            "background:rgba(0,0,0,0.80)",
            "z-index:1000",
            "display:flex",
            "align-items:center",
            "justify-content:center",
        ].join(";");

        // Panel
        const panel = document.createElement("div");
        panel.className = "brogue-modal-panel";
        panel.style.cssText = [
            "background:#0a0a0a",
            "border:1px solid #444",
            "padding:1.5em 2em",
            "max-width:min(90vw,700px)",
            "max-height:85vh",
            "overflow-y:auto",
            "font-family:monospace",
            "font-size:14px",
            "line-height:1.5",
            "color:#ccc",
            "box-sizing:border-box",
            "display:flex",
            "flex-direction:column",
            "gap:1em",
        ].join(";");

        panel.appendChild(_buildTextContent(text));

        // Button row
        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display:flex;gap:0.75em;justify-content:flex-end;flex-wrap:wrap";

        let _resolved = false;
        const resolveWith = (index: number): void => {
            if (_resolved) return;
            _resolved = true;
            document.removeEventListener("keydown", onKey, { capture: true });
            _tbBackdrop?.remove();
            _tbBackdrop = null;
            _tbCleanup = null;
            resolve(index);
        };

        _tbCleanup = () => resolveWith(-1);

        buttons.forEach((btn, idx) => {
            const el = document.createElement("button");
            el.textContent = btn.label;
            el.style.cssText = [
                "background:#1a1a1a",
                "color:#ccc",
                "border:1px solid #555",
                "padding:0.3em 1em",
                "font-family:monospace",
                "font-size:14px",
                "cursor:pointer",
            ].join(";");
            el.addEventListener("mouseover", () => { el.style.background = "#2a2a2a"; el.style.borderColor = "#00aa88"; });
            el.addEventListener("mouseout", () => { el.style.background = "#1a1a1a"; el.style.borderColor = "#555"; });
            el.addEventListener("mousedown", () => { el.style.background = "#333"; });
            el.addEventListener("click", () => resolveWith(idx));
            btnRow.appendChild(el);
        });

        panel.appendChild(btnRow);
        _tbBackdrop.appendChild(panel);
        document.body.appendChild(_tbBackdrop);

        // Keyboard handler: check hotkeys for each button.
        const onKey = (e: KeyboardEvent): void => {
            const code = e.key === "Enter" ? 13
                : e.key === "Escape" ? 27
                : e.key === " " ? 32
                : e.key === "Backspace" ? 8
                : e.key.length === 1 ? e.key.charCodeAt(0)
                : -1;
            for (let i = 0; i < buttons.length; i++) {
                if (buttons[i].hotkeys.includes(code)) {
                    e.preventDefault();
                    e.stopPropagation();
                    resolveWith(i);
                    return;
                }
            }
            // Unknown key: swallow so it doesn't reach the game loop.
            e.preventDefault();
            e.stopPropagation();
        };

        document.addEventListener("keydown", onKey, { capture: true });

        // Backdrop click (outside panel) acts as Escape if one of the buttons
        // has Escape (27) in its hotkeys; otherwise ignored.
        _tbBackdrop.addEventListener("mousedown", (e) => {
            if (e.target !== _tbBackdrop) return;
            for (let i = 0; i < buttons.length; i++) {
                if (buttons[i].hotkeys.includes(27)) {
                    resolveWith(i);
                    return;
                }
            }
        });
    });
}

/** Dismiss any active text-box modal, resolving with -1. */
function _dismissTextBox(): void {
    if (_tbBackdrop) {
        _tbBackdrop.remove();
        _tbBackdrop = null;
    }
    const cleanup = _tbCleanup;
    _tbCleanup = null;
    cleanup?.();
}

// =============================================================================
// Text-entry modal (getInputTextString DOM replacement)
// =============================================================================

/**
 * Show a text-entry dialog as a DOM modal with an `<input>` element.
 *
 * @param prompt      — Label shown above the input.
 * @param defaultText — Pre-filled default value.
 * @param maxLength   — Maximum character count.
 * @param numericOnly — If true, only digits are allowed.
 *
 * Returns the entered string, or null if the user pressed Escape.
 */
export function showInputModal(
    prompt: string,
    defaultText: string,
    maxLength: number,
    numericOnly: boolean,
): Promise<string | null> {
    return new Promise<string | null>(resolve => {
        _dismissTextBox();
        if (_backdrop) _dismiss();

        _tbBackdrop = document.createElement("div");
        _tbBackdrop.style.cssText = [
            "position:fixed",
            "inset:0",
            "background:rgba(0,0,0,0.80)",
            "z-index:1000",
            "display:flex",
            "align-items:center",
            "justify-content:center",
        ].join(";");

        const panel = document.createElement("div");
        panel.style.cssText = [
            "background:#0a0a0a",
            "border:1px solid #444",
            "padding:1.5em 2em",
            "min-width:300px",
            "max-width:min(90vw,600px)",
            "font-family:monospace",
            "font-size:14px",
            "color:#ccc",
            "display:flex",
            "flex-direction:column",
            "gap:0.75em",
        ].join(";");

        const label = document.createElement("div");
        label.textContent = prompt;
        label.style.color = "#ffffff";
        panel.appendChild(label);

        const inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.value = defaultText;
        inputEl.maxLength = maxLength;
        if (numericOnly) inputEl.pattern = "[0-9]*";
        inputEl.style.cssText = [
            "background:#000",
            "color:#fff",
            "border:1px solid #555",
            "padding:0.3em 0.5em",
            "font-family:monospace",
            "font-size:14px",
            "width:100%",
            "box-sizing:border-box",
        ].join(";");
        panel.appendChild(inputEl);

        const hint = document.createElement("div");
        hint.textContent = "Enter to confirm · Escape to cancel";
        hint.style.cssText = "font-size:11px;color:#666";
        panel.appendChild(hint);

        _tbBackdrop.appendChild(panel);
        document.body.appendChild(_tbBackdrop);

        let _resolved = false;
        const finish = (result: string | null): void => {
            if (_resolved) return;
            _resolved = true;
            inputEl.removeEventListener("keydown", onKey);
            _tbBackdrop?.remove();
            _tbBackdrop = null;
            _tbCleanup = null;
            resolve(result);
        };

        _tbCleanup = () => finish(null);

        const onKey = (e: KeyboardEvent): void => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                finish(inputEl.value.slice(0, maxLength));
            } else if (e.key === "Escape") {
                e.preventDefault();
                finish(null);
            }
            // All other keys: let the input element handle them natively.
        };

        inputEl.addEventListener("keydown", onKey);

        // Focus the input and move cursor to end.
        requestAnimationFrame(() => {
            inputEl.focus();
            inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
        });
    });
}
