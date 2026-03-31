/*
 *  items/staff-wiring.ts — Context builders for staff/wand use (useStaffOrWand)
 *  Port V2 — rogue-ts
 *
 *  Exports three pre-bound factory functions wired into buildItemHandlerContext():
 *    buildStaffChooseTargetFn       — real chooseTarget (targeting cursor)
 *    buildStaffPlayerCancelsBlinkingFn — real playerCancelsBlinking
 *    buildStaffZapFn                — real zap() with ZapContext
 *
 *  Implementation is split across two helper modules to keep each file
 *  under the 600-line cap:
 *    staff-targeting-wiring.ts — chooseTarget / playerCancelsBlinking builders
 *    staff-zap-ctx.ts          — full ZapContext construction (buildStaffZapCtx)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { zap as zapFn } from "./zap.js";
import { buildStaffZapCtx } from "./staff-zap-ctx.js";
import type { Bolt, Pos } from "../types/types.js";

export {
    buildStaffChooseTargetFn,
    buildStaffPlayerCancelsBlinkingFn,
} from "./staff-targeting-wiring.js";

// =============================================================================
// buildStaffZapFn — zap() with a fully-wired ZapContext
// =============================================================================

/**
 * Returns a pre-bound zap function for use in ItemHandlerContext.
 * Delegates all context construction to buildStaffZapCtx() (staff-zap-ctx.ts).
 */
export function buildStaffZapFn() {
    return async (
        originLoc: Pos,
        targetLoc: Pos,
        theBolt: Bolt,
        hideDetails: boolean,
        reverseBoltDir: boolean,
    ): Promise<boolean> => {
        const zapCtx = buildStaffZapCtx();
        return zapFn(originLoc, targetLoc, theBolt as never, hideDetails, reverseBoltDir, zapCtx);
    };
}
