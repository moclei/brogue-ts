/*
 *  GlobalControls.tsx — BG color override + Reset All (inside debug panel)
 *  dungeon-cake
 */

import { useState } from "react";

interface GlobalControlsProps {
    bgColorOverride: string | null;
    onBgColorChange: (color: string | null) => void;
    onResetAll: () => void;
}

export function GlobalControls({
    bgColorOverride,
    onBgColorChange,
    onResetAll,
}: GlobalControlsProps) {
    const [bgEnabled, setBgEnabled] = useState(bgColorOverride !== null);

    return (
        <div className="global-controls">
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
