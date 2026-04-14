/*
 *  menus/machine-debug.ts — Machine Room debug tool
 *  Port V2 — rogue-ts
 *
 *  Title-screen dialog for boosting specific machine blueprint types.
 *  Selected blueprints get a large frequency boost and depthRange[0] set to 1
 *  before addMachines runs. Blueprint qualification logic is unchanged.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueButton } from "../types/types.js";
import type { Blueprint } from "../types/types.js";
import type { MenuContext } from "./menu-types.js";
import { blueprintCatalog } from "../globals/blueprint-catalog.js";
import { INTERFACE_OPACITY } from "../types/constants.js";

// =============================================================================
// Constants
// =============================================================================

const BOOST_FREQUENCY = 1000;   // dominates the raffle when selected
const DIALOG_X = 2;
const DIALOG_Y = 3;
const MAX_NAME_LEN = 52;        // truncate long blueprint names

// =============================================================================
// Module state — persists across title-screen visits within a session
// =============================================================================

/** Set of blueprint catalog indices whose frequency/depth are boosted. */
export const boostedBlueprints = new Set<number>();

// =============================================================================
// getDebugBlueprintCatalog — apply in-memory boost before level generation
// =============================================================================

/**
 * Return a version of `catalog` where every boosted index has a large
 * frequency and depthRange[0] = 1.  Returns `catalog` unchanged when no
 * blueprints are boosted.
 */
export function getDebugBlueprintCatalog(
    catalog: readonly Blueprint[],
): readonly Blueprint[] {
    if (boostedBlueprints.size === 0) return catalog;
    return catalog.map((b, i) => {
        if (i === 0 || !boostedBlueprints.has(i)) return b;
        return {
            ...b,
            frequency: BOOST_FREQUENCY,
            depthRange: [1, b.depthRange[1]] as [number, number],
        };
    });
}

// =============================================================================
// Blueprint groups for the category picker
// =============================================================================

interface BpGroup {
    readonly label: string;
    readonly start: number;
    readonly end: number;
}

const BLUEPRINT_GROUPS: readonly BpGroup[] = [
    { label: "Reward rooms",               start: 1,  end: 14 },
    { label: "Amulet & vestibule machines", start: 15, end: 25 },
    { label: "Key machines (1-16)",        start: 26, end: 41 },
    { label: "Key machines (17-32)",       start: 42, end: 57 },
    { label: "Area machines",              start: 58, end: 71 },
];

// =============================================================================
// Helpers
// =============================================================================

function truncateName(name: string, maxLen: number): string {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 3) + "...";
}

function makeButtons(count: number, ctx: MenuContext): BrogueButton[] {
    const btns: BrogueButton[] = [];
    for (let i = 0; i < count; i++) btns.push(ctx.initializeButton());
    return btns;
}

// =============================================================================
// dialogToggleGroup — per-category toggle list
// =============================================================================

async function dialogToggleGroup(
    group: BpGroup,
    ctx: MenuContext,
): Promise<void> {
    const catalogNames = blueprintCatalog.map(b => b.name);
    const entryCount = group.end - group.start + 1;
    const btnCount = entryCount + 1;            // entries + Done
    const buttons = makeButtons(btnCount, ctx);

    const dialogWidth = MAX_NAME_LEN + 6;       // "[ ] " + name + padding

    // Draw the group dialog background once (save/restore wraps the loop)
    const savedBuf = ctx.saveDisplayBuffer();
    const bgDbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(bgDbuf);
    ctx.rectangularShading(
        DIALOG_X - 1, DIALOG_Y - 2,
        dialogWidth + 2, btnCount + 4,
        ctx.interfaceBoxColor, INTERFACE_OPACITY, bgDbuf,
    );
    ctx.printString(
        group.label, DIALOG_X, DIALOG_Y - 1,
        ctx.itemMessageColor, ctx.interfaceBoxColor, bgDbuf,
    );
    ctx.overlayDisplayBuffer(bgDbuf);

    let done = false;
    while (!done) {
        // Update button labels to reflect current toggle state
        for (let i = 0; i < entryCount; i++) {
            const bpIdx = group.start + i;
            const checked = boostedBlueprints.has(bpIdx);
            const rawName = catalogNames[bpIdx] ?? `Blueprint ${bpIdx}`;
            buttons[i].text = (checked ? "[x] " : "[ ] ") + truncateName(rawName, MAX_NAME_LEN);
            buttons[i].x = DIALOG_X;
            buttons[i].y = DIALOG_Y + i;
            buttons[i].hotkey = ["a".charCodeAt(0) + i, "A".charCodeAt(0) + i];
        }
        buttons[entryCount].text = "Done";
        buttons[entryCount].x = DIALOG_X;
        buttons[entryCount].y = DIALOG_Y + entryCount + 1;
        buttons[entryCount].hotkey = [27]; // ESC

        const result = await ctx.buttonInputLoop(
            buttons, btnCount,
            DIALOG_X, DIALOG_Y,
            dialogWidth, btnCount + 2,
        );

        if (result.chosenButton < 0 || result.chosenButton === entryCount) {
            done = true;
        } else {
            const bpIdx = group.start + result.chosenButton;
            if (boostedBlueprints.has(bpIdx)) {
                boostedBlueprints.delete(bpIdx);
            } else {
                boostedBlueprints.add(bpIdx);
            }
        }
    }

    ctx.restoreDisplayBuffer(savedBuf);
}

// =============================================================================
// showMachineDebugMenu — top-level category picker
// =============================================================================

/**
 * Show the machine debug menu from the title screen.
 * User selects blueprint categories, then toggles individual blueprints.
 * All changes take effect for the next new game started this session.
 */
export async function showMachineDebugMenu(ctx: MenuContext): Promise<void> {
    const groupCount = BLUEPRINT_GROUPS.length;
    const clearIdx = groupCount;
    const doneIdx = groupCount + 1;
    const btnCount = groupCount + 2;            // groups + Clear + Done
    const buttons = makeButtons(btnCount, ctx);

    buttons[clearIdx].hotkey = ["c".charCodeAt(0), "C".charCodeAt(0)];
    buttons[doneIdx].hotkey = [27]; // ESC

    let done = false;
    while (!done) {
        // Update group labels with current selection counts
        for (let gi = 0; gi < groupCount; gi++) {
            const g = BLUEPRINT_GROUPS[gi];
            let sel = 0;
            for (let i = g.start; i <= g.end; i++) {
                if (boostedBlueprints.has(i)) sel++;
            }
            const total = g.end - g.start + 1;
            buttons[gi].text = `${g.label} [${sel}/${total}]`;
            buttons[gi].x = DIALOG_X;
            buttons[gi].y = DIALOG_Y + gi;
            buttons[gi].hotkey = ["a".charCodeAt(0) + gi, "A".charCodeAt(0) + gi];
        }
        buttons[clearIdx].text = "Clear all selections";
        buttons[clearIdx].x = DIALOG_X;
        buttons[clearIdx].y = DIALOG_Y + groupCount + 1;
        buttons[doneIdx].text = "Done";
        buttons[doneIdx].x = DIALOG_X;
        buttons[doneIdx].y = DIALOG_Y + groupCount + 2;

        const maxLabelLen = Math.max(...buttons.slice(0, btnCount).map(b => b.text.length));
        const dialogWidth = maxLabelLen + 2;

        const savedBuf = ctx.saveDisplayBuffer();
        const bgDbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(bgDbuf);
        ctx.rectangularShading(
            DIALOG_X - 1, DIALOG_Y - 2,
            dialogWidth + 2, btnCount + 4,
            ctx.interfaceBoxColor, INTERFACE_OPACITY, bgDbuf,
        );
        ctx.printString(
            "Machine Debug: select types to boost",
            DIALOG_X, DIALOG_Y - 1,
            ctx.itemMessageColor, ctx.interfaceBoxColor, bgDbuf,
        );
        ctx.overlayDisplayBuffer(bgDbuf);

        const result = await ctx.buttonInputLoop(
            buttons, btnCount,
            DIALOG_X, DIALOG_Y,
            dialogWidth, btnCount + 3,
        );
        ctx.restoreDisplayBuffer(savedBuf);

        if (result.chosenButton < 0 || result.chosenButton === doneIdx) {
            done = true;
        } else if (result.chosenButton === clearIdx) {
            boostedBlueprints.clear();
        } else if (result.chosenButton >= 0 && result.chosenButton < groupCount) {
            await dialogToggleGroup(BLUEPRINT_GROUPS[result.chosenButton], ctx);
        }
    }
}
