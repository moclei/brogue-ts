/*
 *  Toolbar.tsx — Generation controls, view toggles
 *  dungeon-cake
 */

import { useState, useCallback } from "react";
import type { FogMode } from "../generation/query-context.js";
import { FOG_MODES } from "../generation/query-context.js";

interface ToolbarProps {
    depth: number;
    seed: number;
    zoom: number;
    fogMode: FogMode;
    lightingEnabled: boolean;
    showVariantIndices: boolean;
    onGenerate: (depth: number, seed: number) => void;
    onReroll: () => void;
    onZoomChange: (zoom: number) => void;
    onFogModeChange: (mode: FogMode) => void;
    onToggleLighting: (enabled: boolean) => void;
    onShowVariantIndices: (enabled: boolean) => void;
}

export function Toolbar({
    depth: initialDepth,
    seed: initialSeed,
    zoom,
    fogMode,
    lightingEnabled,
    showVariantIndices,
    onGenerate,
    onReroll,
    onZoomChange,
    onFogModeChange,
    onToggleLighting,
    onShowVariantIndices,
}: ToolbarProps) {
    const [depthInput, setDepthInput] = useState(String(initialDepth));
    const [seedInput, setSeedInput] = useState(String(initialSeed));

    const handleGenerate = useCallback(() => {
        const d = Math.max(1, Math.min(40, parseInt(depthInput, 10) || 5));
        const s = parseInt(seedInput, 10) || 42;
        setDepthInput(String(d));
        onGenerate(d, s);
    }, [depthInput, seedInput, onGenerate]);

    const handleReroll = useCallback(() => {
        const nextSeed = (parseInt(seedInput, 10) || 42) + 1;
        setSeedInput(String(nextSeed));
        onReroll();
    }, [seedInput, onReroll]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleGenerate();
    }, [handleGenerate]);

    return (
        <div className="toolbar">
            <label>
                Depth:
                <input
                    type="number"
                    min={1}
                    max={40}
                    value={depthInput}
                    onChange={(e) => setDepthInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </label>
            <label>
                Seed:
                <input
                    type="number"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </label>
            <button onClick={handleGenerate}>Generate</button>
            <button onClick={handleReroll}>Re-roll</button>
            <div className="toolbar-separator" />
            <label>
                Zoom:
                <select
                    value={zoom}
                    onChange={(e) => onZoomChange(Number(e.target.value))}
                >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                </select>
            </label>
            <label>
                Fog:
                <select
                    value={fogMode}
                    onChange={(e) => onFogModeChange(e.target.value as FogMode)}
                >
                    {FOG_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                            {m.label}
                        </option>
                    ))}
                </select>
            </label>
            <label title="Compute dungeon lighting (glowing tiles + miner's light)">
                <input
                    type="checkbox"
                    checked={lightingEnabled}
                    onChange={(e) => onToggleLighting(e.target.checked)}
                />
                Lighting
            </label>
            <label title="Show autotile variant index on each cell">
                <input
                    type="checkbox"
                    checked={showVariantIndices}
                    onChange={(e) => onShowVariantIndices(e.target.checked)}
                />
                Variants
            </label>
        </div>
    );
}
