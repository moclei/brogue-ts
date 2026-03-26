/*
 *  DebugPanel.tsx — Bottom panel with per-layer debug controls
 *  dungeon-cake (Phase 1b — visibility toggles, Phase 2 adds tint/alpha/blend)
 */

import { LAYER_NAMES } from "../state/debug-state.js";
import { LayerColumn } from "./LayerColumn.js";

interface DebugPanelProps {
    enabled: boolean;
    layerVisible: boolean[];
    onToggleLayer: (index: number) => void;
    onToggleEnabled: (enabled: boolean) => void;
    onReset: () => void;
}

export function DebugPanel({
    enabled,
    layerVisible,
    onToggleLayer,
    onToggleEnabled,
    onReset,
}: DebugPanelProps) {
    return (
        <div className="debug-panel">
            <div className="debug-header">
                <label className="debug-enable">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => onToggleEnabled(e.target.checked)}
                    />
                    <span>Layer Debug</span>
                </label>
                <button className="debug-reset" onClick={onReset}>
                    Reset
                </button>
            </div>
            {enabled && (
                <div className="layer-grid">
                    {LAYER_NAMES.map((name, i) => (
                        <LayerColumn
                            key={name}
                            name={name}
                            index={i}
                            visible={layerVisible[i]}
                            onToggle={onToggleLayer}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
