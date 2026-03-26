/*
 *  GlobalControls.tsx — Lighting toggle, background color override, Reset All
 *  dungeon-cake
 */

import { useState } from "react";

interface GlobalControlsProps {
    lightingEnabled: boolean;
    bgColorOverride: string | null;
    onToggleLighting: (enabled: boolean) => void;
    onBgColorChange: (color: string | null) => void;
    onResetAll: () => void;
}

export function GlobalControls({
    lightingEnabled,
    bgColorOverride,
    onToggleLighting,
    onBgColorChange,
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

            <button className="reset-all-btn" onClick={onResetAll}>
                Reset All
            </button>
        </div>
    );
}
