/*
 *  App.tsx — Root layout: toolbar, dungeon canvas, debug panel, global controls
 *  dungeon-cake
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Pcell } from "@game/types/types.js";
import type { FogMode } from "./generation/query-context.js";
import { generateLevel } from "./generation/generate-level.js";
import { Toolbar } from "./components/Toolbar.js";
import { DungeonCanvas } from "./rendering/dungeon-canvas.js";
import { DebugPanel } from "./components/DebugPanel.js";
import { GlobalControls } from "./components/GlobalControls.js";
import { useDebugState } from "./state/debug-state.js";
import {
    DungeonStateContext,
    DungeonActionsContext,
} from "./state/dungeon-state.js";

const STORAGE_KEY_DEPTH = "dungeon-cake:depth";
const STORAGE_KEY_SEED = "dungeon-cake:seed";

function loadPersistedNumber(key: string, fallback: number): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const n = Number(raw);
        return Number.isFinite(n) ? n : fallback;
    } catch {
        return fallback;
    }
}

export function App() {
    const [depth, setDepth] = useState(() => loadPersistedNumber(STORAGE_KEY_DEPTH, 5));
    const [seed, setSeed] = useState(() => loadPersistedNumber(STORAGE_KEY_SEED, 42));
    const [zoom, setZoom] = useState(2);
    const [pmap, setPmap] = useState<Pcell[][] | null>(null);
    const [generating, setGenerating] = useState(false);
    const [lightingEnabled, setLightingEnabled] = useState(false);
    const [fogMode, setFogMode] = useState<FogMode>("visible");

    const debug = useDebugState();
    const didAutoGenerate = useRef(false);

    const generate = useCallback((d: number, s: number) => {
        setGenerating(true);
        setDepth(d);
        setSeed(s);
        localStorage.setItem(STORAGE_KEY_DEPTH, String(d));
        localStorage.setItem(STORAGE_KEY_SEED, String(s));
        requestAnimationFrame(() => {
            try {
                const result = generateLevel(d, s);
                setPmap(result.pmap);
            } catch (err) {
                console.error("Generation failed:", err);
            } finally {
                setGenerating(false);
            }
        });
    }, []);

    useEffect(() => {
        if (didAutoGenerate.current) return;
        didAutoGenerate.current = true;
        generate(depth, seed);
    }, [depth, seed, generate]);

    const reroll = useCallback(() => {
        const nextSeed = seed + 1;
        generate(depth, nextSeed);
    }, [depth, seed, generate]);

    const handleResetAll = useCallback(() => {
        debug.reset();
        setLightingEnabled(false);
        setFogMode("visible");
    }, [debug]);

    return (
        <DungeonStateContext.Provider value={{ pmap, depth, seed }}>
            <DungeonActionsContext.Provider value={{ generate, reroll }}>
                <div className="app">
                    <Toolbar
                        depth={depth}
                        seed={seed}
                        zoom={zoom}
                        fogMode={fogMode}
                        onGenerate={generate}
                        onReroll={reroll}
                        onZoomChange={setZoom}
                        onFogModeChange={setFogMode}
                    />
                    <div className="main-content">
                        {generating && <div className="generating">Generating...</div>}
                        <DungeonCanvas
                            pmap={pmap}
                            zoom={zoom}
                            redrawCounter={debug.state.redrawCounter}
                            lightingEnabled={lightingEnabled}
                            fogMode={fogMode}
                        />
                    </div>
                    <DebugPanel
                        enabled={debug.state.enabled}
                        layers={debug.state.layers}
                        onToggleLayer={debug.toggleLayer}
                        onToggleEnabled={debug.setEnabled}
                        onAlpha={debug.setAlpha}
                        onBlendMode={debug.setBlendMode}
                        onTintAlpha={debug.setTintAlpha}
                        onFilter={debug.setFilter}
                        onShadowColor={debug.setShadowColor}
                        onReset={debug.reset}
                    >
                        <GlobalControls
                            lightingEnabled={lightingEnabled}
                            bgColorOverride={debug.state.bgColorOverride}
                            showVariantIndices={debug.state.showVariantIndices}
                            onToggleLighting={setLightingEnabled}
                            onBgColorChange={debug.setBgColor}
                            onShowVariantIndices={debug.setShowVariantIndices}
                            onResetAll={handleResetAll}
                        />
                    </DebugPanel>
                </div>
            </DungeonActionsContext.Provider>
        </DungeonStateContext.Provider>
    );
}
