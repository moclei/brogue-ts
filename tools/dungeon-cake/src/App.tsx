/*
 *  App.tsx — Root layout: toolbar, dungeon canvas, debug panel, global controls
 *  dungeon-cake
 */

import { useState, useCallback } from "react";
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

export function App() {
    const [depth, setDepth] = useState(5);
    const [seed, setSeed] = useState(42);
    const [zoom, setZoom] = useState(2);
    const [pmap, setPmap] = useState<Pcell[][] | null>(null);
    const [generating, setGenerating] = useState(false);
    const [lightingEnabled, setLightingEnabled] = useState(false);
    const [fogMode, setFogMode] = useState<FogMode>("visible");

    const debug = useDebugState();

    const generate = useCallback((d: number, s: number) => {
        setGenerating(true);
        setDepth(d);
        setSeed(s);
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
                        onTintEnabled={debug.setTintEnabled}
                        onTintColor={debug.setTintColor}
                        onTintAlpha={debug.setTintAlpha}
                        onAlpha={debug.setAlpha}
                        onBlendMode={debug.setBlendMode}
                        onReset={debug.reset}
                    >
                        <GlobalControls
                            lightingEnabled={lightingEnabled}
                            bgColorOverride={debug.state.bgColorOverride}
                            onToggleLighting={setLightingEnabled}
                            onBgColorChange={debug.setBgColor}
                            onResetAll={handleResetAll}
                        />
                    </DebugPanel>
                </div>
            </DungeonActionsContext.Provider>
        </DungeonStateContext.Provider>
    );
}
