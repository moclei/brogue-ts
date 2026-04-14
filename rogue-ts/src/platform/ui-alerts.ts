/*
 *  platform/ui-alerts.ts — DOM toast/alert overlays
 *  Port V2 — rogue-ts / ui-extraction Phase 3b
 *
 *  Replaces the buffer-based flashMessage / displayCenteredAlert animations
 *  with lightweight DOM toast elements that use CSS opacity transitions.
 *
 *  showFlashAlert(message, durationMs)
 *    — Centered fixed toast with CSS fade-in / hold / fade-out.
 *      Returns a Promise that resolves when the animation completes.
 *
 *  showCenteredAlert(message)
 *    — Non-blocking: shows a brief toast and returns immediately.
 *      Used for displayCenteredAlert which is synchronous in C.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// Minimum visible time for the toast before it begins fading out.
const FADE_MS = 150;

// =============================================================================
// Internal helpers
// =============================================================================

function _createToast(message: string): HTMLElement {
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = [
        "position:fixed",
        "top:50%",
        "left:50%",
        "transform:translate(-50%,-50%)",
        "background:rgba(0,0,0,0.88)",
        "color:#00ccaa",
        "font-family:monospace",
        "font-size:15px",
        "padding:0.4em 1.4em",
        "border:1px solid #336655",
        "pointer-events:none",
        "z-index:2000",
        "opacity:0",
        `transition:opacity ${FADE_MS}ms ease-in-out`,
    ].join(";");
    return el;
}

// =============================================================================
// showFlashAlert — async, fades over durationMs
// =============================================================================

/**
 * Display a centered toast message with a CSS fade-in / hold / fade-out
 * animation spanning `durationMs` milliseconds.
 *
 * Mirrors the buffer/canvas animation in `flashMessage` / `flashTemporaryAlert`
 * but uses CSS transitions instead of per-frame `pauseBrogue` calls.
 *
 * Returns a Promise that resolves when the toast has fully faded out.
 */
export function showFlashAlert(message: string, durationMs: number): Promise<void> {
    return new Promise<void>(resolve => {
        const toast = _createToast(message);
        document.body.appendChild(toast);

        // Trigger reflow so the initial opacity:0 is painted before transitioning.
        void toast.offsetHeight;
        toast.style.opacity = "1";

        // After holding for most of durationMs, fade out and resolve.
        const holdMs = Math.max(0, durationMs - FADE_MS);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => {
                toast.remove();
                resolve();
            }, FADE_MS);
        }, holdMs);
    });
}

// =============================================================================
// showCenteredAlert — non-blocking, fire-and-forget
// =============================================================================

/**
 * Show a brief centered toast without waiting for it to finish.
 *
 * Mirrors `displayCenteredAlert` which in C draws to the buffer and returns
 * synchronously. The DOM version shows the toast and returns immediately;
 * the fade-out happens asynchronously.
 */
export function showCenteredAlert(message: string): void {
    void showFlashAlert(message, 2000);
}
