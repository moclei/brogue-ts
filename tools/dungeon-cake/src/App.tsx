/*
 *  App.tsx — Root layout: toolbar, dungeon canvas
 *  dungeon-cake
 */

import { useState, useCallback } from "react";
import type { Pcell } from "@game/types/types.js";
import { generateLevel } from "./generation/generate-level.js";
import { Toolbar } from "./components/Toolbar.js";
import { DungeonCanvas } from "./rendering/dungeon-canvas.js";
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

    const generate = useCallback((d: number, s: number) => {
        setGenerating(true);
        setDepth(d);
        setSeed(s);
        // Defer to let React render the "generating" state
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

    return (
        <DungeonStateContext.Provider value={{ pmap, depth, seed }}>
            <DungeonActionsContext.Provider value={{ generate, reroll }}>
                <div className="app">
                    <Toolbar
                        depth={depth}
                        seed={seed}
                        zoom={zoom}
                        onGenerate={generate}
                        onReroll={reroll}
                        onZoomChange={setZoom}
                    />
                    <div className="main-content">
                        {generating && <div className="generating">Generating...</div>}
                        <DungeonCanvas pmap={pmap} zoom={zoom} />
                    </div>
                </div>
            </DungeonActionsContext.Provider>
        </DungeonStateContext.Provider>
    );
}
