/*
 *  platform/ui-inventory-modal.ts — DOM inventory list modal
 *  Port V2 — rogue-ts / ui-extraction Phase 3d
 *
 *  Provides showInventoryModal: displays a styled item list, captures
 *  keyboard/mouse input, and returns the chosen item index plus modifier state.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// =============================================================================
// Types
// =============================================================================

/** A single item row for the inventory modal. */
export interface InventoryModalItem {
    /** Inventory letter ('a', 'b', ...). */
    letter: string;
    /** Unicode character for the item glyph. */
    glyphChar: string;
    /** Formatted item name (plain text, no Brogue escape codes). */
    name: string;
    /** " (in hand)" | " (worn)" | "" */
    equippedSuffix: string;
    /** Whether this item can be selected in this context. */
    selectable: boolean;
    /** Magic detection indicator: "" | "-" | "⊕" | "⊖" etc. */
    magicChar: string;
    /** CSS color string for the magic indicator. */
    magicColor: string;
}

/** Display options for the inventory modal. */
export interface InventoryModalOptions {
    /** Number of equipped items at the start of the list. */
    equippedCount: number;
    /**
     * When true, show pack space hint and instruction text.
     * Items are selectable for detail view (drill-down).
     */
    waitForAcknowledge: boolean;
    /** Pack space line (e.g. "You have room for 5 more items."). */
    packSpaceHint: string;
    /** Instruction line (e.g. " -- press (a-z) for more info -- "). */
    instructionText: string;
}

/** Result from showInventoryModal. */
export interface InventoryModalResult {
    /** Chosen item index (0-based), or -1 for cancel. */
    chosenIndex: number;
    shiftKey: boolean;
    controlKey: boolean;
}

// =============================================================================
// showInventoryModal
// =============================================================================

/**
 * Display the inventory as a DOM modal list.
 *
 * Keyboard:
 *   - a–z: select item with matching inventory letter
 *   - Shift+letter / Ctrl+letter: select with modifier (triggers drill-down)
 *   - ArrowUp / ArrowDown: move focus row
 *   - Enter: select focused item; Shift+Enter for drill-down
 *   - Escape: cancel
 *
 * Mouse:
 *   - Click item row: select (Shift/Ctrl detected)
 *   - Click outside panel: cancel
 */
export function showInventoryModal(
    items: InventoryModalItem[],
    options: InventoryModalOptions,
): Promise<InventoryModalResult> {
    return new Promise<InventoryModalResult>(resolve => {
        let _resolved = false;
        let focusedIndex = -1;
        const rowEls: HTMLElement[] = [];

        const resolveWith = (result: InventoryModalResult): void => {
            if (_resolved) return;
            _resolved = true;
            document.removeEventListener("keydown", onKey, { capture: true });
            backdrop.remove();
            resolve(result);
        };

        // --- Backdrop ---
        const backdrop = document.createElement("div");
        backdrop.style.cssText = [
            "position:fixed", "inset:0", "background:rgba(0,0,0,0.80)",
            "z-index:1000", "display:flex", "align-items:center", "justify-content:center",
        ].join(";");

        // --- Panel ---
        const panel = document.createElement("div");
        panel.style.cssText = [
            "background:#0a0a0a", "border:1px solid #555",
            "padding:0.5em 0", "min-width:300px", "max-width:min(90vw,640px)",
            "max-height:85vh", "overflow-y:auto",
            "font-family:monospace", "font-size:14px", "color:#ccc",
            "display:flex", "flex-direction:column",
        ].join(";");

        // --- Focus helpers ---
        const setFocus = (idx: number): void => {
            if (focusedIndex >= 0 && focusedIndex < rowEls.length) {
                rowEls[focusedIndex].style.background = "";
                (rowEls[focusedIndex].querySelector(".inv-name") as HTMLElement | null)?.style
                    && Object.assign((rowEls[focusedIndex].querySelector(".inv-name") as HTMLElement).style, { color: "" });
            }
            focusedIndex = idx;
            if (idx >= 0 && idx < rowEls.length) {
                rowEls[idx].style.background = "#1e3a2f";
                rowEls[idx].scrollIntoView({ block: "nearest" });
            }
        };

        const findNextSelectable = (from: number, delta: 1 | -1): number => {
            if (items.length === 0) return -1;
            let i = (from + delta + items.length) % items.length;
            const start = i;
            while (!items[i].selectable) {
                i = (i + delta + items.length) % items.length;
                if (i === start) return -1;
            }
            return i;
        };

        const moveFocus = (delta: 1 | -1): void => {
            if (items.every(it => !it.selectable)) return;
            if (focusedIndex < 0) {
                // Find first selectable
                const first = items.findIndex(it => it.selectable);
                if (first >= 0) setFocus(first);
            } else {
                const next = findNextSelectable(focusedIndex, delta);
                if (next >= 0) setFocus(next);
            }
        };

        // --- Item rows ---
        items.forEach((item, idx) => {
            // Separator before first non-equipped item
            if (idx === options.equippedCount && options.equippedCount > 0) {
                const sep = document.createElement("div");
                sep.style.cssText =
                    "padding:0.15em 1em;color:#555;font-size:12px;pointer-events:none;user-select:none";
                sep.textContent = "   ---";
                panel.appendChild(sep);
            }

            const row = document.createElement("div");
            row.style.cssText = [
                "padding:0.25em 1em",
                `cursor:${item.selectable ? "pointer" : "default"}`,
                "display:flex", "gap:0.4em", "align-items:baseline",
                "white-space:nowrap", "user-select:none",
            ].join(";");

            // Inventory letter
            const letterEl = document.createElement("span");
            letterEl.textContent = `${item.letter})`;
            letterEl.style.cssText = "color:#888;min-width:1.8em;text-align:right;flex-shrink:0";
            row.appendChild(letterEl);

            // Magic indicator (if present)
            if (item.magicChar) {
                const magicEl = document.createElement("span");
                magicEl.textContent = item.magicChar;
                magicEl.style.cssText =
                    `color:${item.magicColor};min-width:1em;text-align:center;flex-shrink:0`;
                row.appendChild(magicEl);
            }

            // Item glyph
            const glyphEl = document.createElement("span");
            glyphEl.textContent = item.glyphChar;
            glyphEl.style.cssText =
                `color:${item.selectable ? "#ddbb44" : "#665522"};min-width:1em;text-align:center;flex-shrink:0`;
            row.appendChild(glyphEl);

            // Item name + equipped suffix
            const nameEl = document.createElement("span");
            nameEl.className = "inv-name";
            nameEl.textContent = item.name
                + (item.equippedSuffix ? ` ${item.equippedSuffix.trim()}` : "");
            nameEl.style.cssText = `color:${item.selectable ? "#cccccc" : "#666666"}`;
            row.appendChild(nameEl);

            // Hover / click
            if (item.selectable) {
                row.addEventListener("mouseover", () => setFocus(idx));
                row.addEventListener("click", (e) => {
                    resolveWith({
                        chosenIndex: idx,
                        shiftKey: e.shiftKey,
                        controlKey: e.ctrlKey || e.metaKey,
                    });
                });
            }

            panel.appendChild(row);
            rowEls.push(row);
        });

        // --- Hint / instruction lines (waitForAcknowledge) ---
        if (options.waitForAcknowledge && options.packSpaceHint) {
            const hintEl = document.createElement("div");
            hintEl.style.cssText =
                "padding:0.3em 1em;color:#555;font-size:12px;pointer-events:none;user-select:none;margin-top:0.25em";
            hintEl.textContent = options.packSpaceHint;
            panel.appendChild(hintEl);
        }
        if (options.waitForAcknowledge && options.instructionText) {
            const instrEl = document.createElement("div");
            instrEl.style.cssText =
                "padding:0.1em 1em;color:#555;font-size:12px;pointer-events:none;user-select:none";
            instrEl.textContent = options.instructionText;
            panel.appendChild(instrEl);
        }

        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);

        // --- Keyboard handler ---
        const onKey = (e: KeyboardEvent): void => {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === "Escape") {
                resolveWith({ chosenIndex: -1, shiftKey: false, controlKey: false });
                return;
            }
            if (e.key === "ArrowUp") {
                moveFocus(-1);
                return;
            }
            if (e.key === "ArrowDown") {
                moveFocus(1);
                return;
            }
            if (e.key === "Enter") {
                if (focusedIndex >= 0 && items[focusedIndex].selectable) {
                    resolveWith({
                        chosenIndex: focusedIndex,
                        shiftKey: e.shiftKey,
                        controlKey: e.ctrlKey || e.metaKey,
                    });
                }
                return;
            }
            // Letter key (a-z / A-Z): find item with matching inventory letter
            if (e.key.length === 1) {
                const lower = e.key.toLowerCase();
                const idx = items.findIndex(it => it.letter === lower && it.selectable);
                if (idx >= 0) {
                    resolveWith({
                        chosenIndex: idx,
                        shiftKey: e.shiftKey,
                        controlKey: e.ctrlKey || e.metaKey,
                    });
                }
                // Unknown letter: swallowed (already prevented above)
            }
        };

        document.addEventListener("keydown", onKey, { capture: true });

        // Click outside panel → cancel
        backdrop.addEventListener("mousedown", (e) => {
            if (e.target === backdrop) {
                resolveWith({ chosenIndex: -1, shiftKey: false, controlKey: false });
            }
        });
    });
}
