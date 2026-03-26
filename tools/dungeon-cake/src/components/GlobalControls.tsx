/*
 *  GlobalControls.tsx — Lighting, bg color, variant indices, Reset All
 *  dungeon-cake
 */

import { useState } from "react";

interface GlobalControlsProps {
    lightingEnabled: boolean;
    bgColorOverride: string | null;
    showVariantIndices: boolean;
    onToggleLighting: (enabled: boolean) => void;
    onBgColorChange: (color: string | null) => void;
    onShowVariantIndices: (enabled: boolean) => void;
    onResetAll: () => void;
}

export function GlobalControls({
    lightingEnabled,
    bgColorOverride,
    showVariantIndices,
    onToggleLighting,
    onBgColorChange,
    onShowVariantIndices,
    onResetAll,
}: GlobalControlsProps) {
    const [bgEnabled, setBgEnabled] = useState(bgColorOverride !== null);

    return (
        <div className="global-controls">
            <label className="global-control" title="Compute dungeon lighting (glowing tiles + miner's light)">
                <input
                    type="checkbox"
                    checked={lightingEnabled}
                    onChange={(e) => onToggleLighting(e.target.checked)}
                />
                <span>Lighting</span>
            </label>

            <div className="global-control" title="Override canvas background color">
                <label className="bg-override-label">
                    <input
                        type="checkbox"
                        checked={bgEnabled}
                        onChange={(e) => {
                            setBgEnabled(e.target.checked);
                            onBgColorChange(e.target.checked ? (bgColorOverride ?? "#000000") : null);
                        }}
                    />
                    <span>BG</span>
                </label>
                <input
                    type="color"
                    className="bg-picker"
                    value={bgColorOverride ?? "#000000"}
                    disabled={!bgEnabled}
                    onChange={(e) => onBgColorChange(e.target.value)}
                />
            </div>

            <label className="global-control" title="Show autotile variant index on each cell">
                <input
                    type="checkbox"
                    checked={showVariantIndices}
                    onChange={(e) => onShowVariantIndices(e.target.checked)}
                />
                <span>Variants</span>
            </label>

            <button className="reset-all-btn" onClick={onResetAll}>
                Reset All
            </button>
        </div>
    );
}
